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
    const { title, description } = await req.json();

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
      })
      .select()
      .single();

    if (error) throw error;

    // Try to get AI label suggestion, but don't fail if it errors
    let label = null;
    try {
      if (OPENAI_API_KEY) {
        // Initialize OpenAI
        const openai = new OpenAI({
          apiKey: OPENAI_API_KEY,
        });

        // Get label suggestion from OpenAI
        const prompt = `Based on this task title: "${title}" and description: "${description}", suggest ONE of these labels: work, personal, priority, shopping, home. Reply with just the label word and nothing else.`;

        const completion = await openai.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "gpt-4o-mini",
          temperature: 0.3,
          max_tokens: 16,
        });

        const suggestedLabel = completion.choices[0].message.content
          ?.toLowerCase()
          .trim();

        console.log(`✨ AI Suggested Label: ${suggestedLabel}`);

        // Validate the label
        const validLabels = ["work", "personal", "priority", "shopping", "home"];
        label = validLabels.includes(suggestedLabel) ? suggestedLabel : null;

        // Update the task with the suggested label if we got one
        if (label) {
          const { data: updatedTask, error: updateError } = await supabaseClient
            .from("tasks")
            .update({ label })
            .eq("task_id", data.task_id)
            .select()
            .single();

          if (updateError) {
            console.error("Error updating task with label:", updateError);
            // Don't throw - return the task without the label
          } else {
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
    } catch (aiError) {
      // Log the error but don't fail the request - task was already created
      console.error("Error getting AI label suggestion:", aiError);
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
