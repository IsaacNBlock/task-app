// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "npm:openai";

// Load environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { title, description, priority_level } = await req.json();

    console.log("🔄 Creating task with AI suggestions...");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Initialize Supabase client
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get user session
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("No user found");

    // Create the task
    const { data, error } = await supabaseClient
      .from("tasks")
      .insert({
        title,
        description,
        completed: false,
        user_id: user.id,
        priority_level: priority_level !== undefined ? priority_level : null,
      })
      .select()
      .single();

    if (error) throw error;

    // Try to get AI label suggestion, but don't fail if it errors
    let label = null;
    try {
      // Check if OpenAI API key is configured
      if (!OPENAI_API_KEY || OPENAI_API_KEY.trim() === "") {
        console.warn("⚠️ OPENAI_API_KEY is not set. Task created without AI label.");
        console.log("💡 To enable AI labels, set the secret: supabase secrets set OPENAI_API_KEY=sk-...");
      } else {
        console.log("🔑 OpenAI API key found, generating label...");
        
        // Initialize OpenAI
        const openai = new OpenAI({
          apiKey: OPENAI_API_KEY,
        });

        // Get label suggestion from OpenAI
        const prompt = `Based on this task title: "${title}" and description: "${description}", suggest ONE of these labels: work, personal, priority, shopping, home. Reply with just the label word and nothing else.`;

        console.log("📤 Sending request to OpenAI...");
        const completion = await openai.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "gpt-4o-mini",
          temperature: 0.3,
          max_tokens: 16,
        });

        const rawResponse = completion.choices[0]?.message?.content;
        console.log(`📥 OpenAI raw response: "${rawResponse}"`);

        if (!rawResponse) {
          console.warn("⚠️ OpenAI returned empty response");
        } else {
          // Clean the response - remove punctuation, extra whitespace, and extract just the label
          let suggestedLabel = rawResponse.toLowerCase().trim();
          // Remove common punctuation and extra words
          suggestedLabel = suggestedLabel
            .replace(/^[^a-z]*/, "") // Remove leading non-letters
            .replace(/[^a-z]*$/, "") // Remove trailing non-letters
            .replace(/\s+/g, " ") // Normalize whitespace
            .trim();
          
          // Try to find a valid label in the response (in case OpenAI added extra text)
          const validLabels = ["work", "personal", "priority", "shopping", "home"];
          label = validLabels.find(l => suggestedLabel.includes(l)) || null;
          
          // If no match found, try exact match
          if (!label && validLabels.includes(suggestedLabel)) {
            label = suggestedLabel;
          }
          
          console.log(`✨ AI Suggested Label (cleaned): "${suggestedLabel}"`);

          if (!label) {
            console.warn(`⚠️ Invalid label "${suggestedLabel}" - not in valid list: ${validLabels.join(", ")}`);
          } else {
            console.log(`✅ Valid label found: "${label}"`);
          }

          // Update the task with the suggested label if we got one
          if (label) {
            const { data: updatedTask, error: updateError } = await supabaseClient
              .from("tasks")
              .update({ label })
              .eq("task_id", data.task_id)
              .select()
              .single();

            if (updateError) {
              console.error("❌ Error updating task with label:", updateError);
              // Don't throw - return the task without the label
            } else {
              console.log(`✅ Task updated with label: "${label}"`);
              // Return the updated task with label
              return new Response(JSON.stringify(updatedTask), {
                headers: {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*",
                },
              });
            }
          }
        }
      }
    } catch (aiError: any) {
      // Log the error but don't fail the request - task was already created
      const errorMessage = aiError?.message || "Unknown AI error";
      const statusCode = aiError?.status || aiError?.response?.status;
      const errorCode = aiError?.code || aiError?.response?.data?.error?.code;
      
      console.error("❌ OpenAI API Error Details:", {
        message: errorMessage,
        status: statusCode,
        code: errorCode,
        type: aiError?.type,
        fullError: JSON.stringify(aiError, Object.getOwnPropertyNames(aiError)),
      });
      
      if (statusCode === 401 || errorCode === "invalid_api_key") {
        console.error("🔑 Invalid OpenAI API key. Please check your OPENAI_API_KEY secret.");
      } else if (statusCode === 429) {
        console.warn("⚠️ OpenAI quota exceeded. Task created without AI label.");
      } else if (statusCode === 500 || statusCode === 503) {
        console.warn("⚠️ OpenAI service unavailable. Task created without AI label.");
      } else {
        console.error(`❌ Unexpected OpenAI error (${statusCode}): ${errorMessage}`);
      }
      // Task will be returned without label - this is fine
    }

    // Return the task (with or without label)
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in create-task-with-ai:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
