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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TaskSuggestions {
  priorityLevel: number;
  suggestedSubtasks: string[];
  improvements: string[];
  estimatedTime: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { title, description } = await req.json();

    if (!title) {
      throw new Error("Task title is required");
    }

    console.log("🤖 Generating smart suggestions for task...");
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

    // Check if OpenAI API key is configured
    if (!OPENAI_API_KEY || OPENAI_API_KEY.trim() === "") {
      console.warn("⚠️ OPENAI_API_KEY is not set.");
      return new Response(
        JSON.stringify({
          error: "OpenAI API key is not configured. Please set OPENAI_API_KEY secret.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });

    // Create prompt for smart suggestions
    const prompt = `Analyze the following task and provide suggestions in JSON format:

Task Title: "${title}"
Task Description: "${description || "No description provided"}"

Provide your analysis as a JSON object with the following structure:
{
  "priorityLevel": <number between 1-5, where 1 is lowest and 5 is highest>,
  "suggestedSubtasks": [<array of 2-4 specific actionable subtasks as strings>],
  "improvements": [<array of 2-3 suggestions to improve the task description or approach as strings>],
  "estimatedTime": "<estimated time to complete (e.g., '30 minutes', '2 hours', '1 day')>"
}

Consider:
- Priority level based on urgency and importance
- Break down the task into specific, actionable subtasks
- Suggest improvements for clarity, efficiency, or completeness
- Provide a realistic time estimate

Return ONLY valid JSON, no additional text.`;

    console.log("📤 Sending request to OpenAI...");
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4o-mini",
      temperature: 0.5,
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    const rawResponse = completion.choices[0]?.message?.content;
    console.log(`📥 OpenAI response received`);

    if (!rawResponse) {
      throw new Error("OpenAI returned empty response");
    }

    // Parse the JSON response
    let suggestions: TaskSuggestions;
    try {
      suggestions = JSON.parse(rawResponse);

      // Validate and sanitize the response
      if (typeof suggestions.priorityLevel !== "number") {
        suggestions.priorityLevel = 3;
      } else {
        // Ensure priority is between 1 and 5
        suggestions.priorityLevel = Math.max(1, Math.min(5, Math.round(suggestions.priorityLevel)));
      }

      if (!Array.isArray(suggestions.suggestedSubtasks)) {
        suggestions.suggestedSubtasks = [];
      }

      if (!Array.isArray(suggestions.improvements)) {
        suggestions.improvements = [];
      }

      if (typeof suggestions.estimatedTime !== "string") {
        suggestions.estimatedTime = "Unknown";
      }
    } catch (parseError) {
      console.error("❌ Error parsing OpenAI response:", parseError);
      throw new Error("Failed to parse AI suggestions");
    }

    console.log(`✅ Suggestions generated successfully`);

    // Return the suggestions
    return new Response(JSON.stringify(suggestions), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in get-task-suggestions:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

