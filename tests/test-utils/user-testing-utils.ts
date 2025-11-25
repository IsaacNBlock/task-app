import { supabase, supabaseServiceClient } from "./supabase-client";

export interface TestUser {
  id?: string;
  name?: string;
  email: string;
  password: string;
}

export async function getOrCreateTestUser(
  userConfig: TestUser
): Promise<TestUser> {
  // Try to sign in first
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: userConfig.email,
      password: userConfig.password,
    });

  // If user exists, return it
  if (signInData.user && signInData.session) {
    // Verify profile exists (it should be created by trigger)
    const { data: profile } = await supabaseServiceClient
      .from("profiles")
      .select("user_id")
      .eq("user_id", signInData.user.id)
      .single();
    
    if (!profile) {
      // Profile doesn't exist, wait a bit and check again
      await new Promise(resolve => setTimeout(resolve, 500));
      const { data: profileRetry } = await supabaseServiceClient
        .from("profiles")
        .select("user_id")
        .eq("user_id", signInData.user.id)
        .single();
      
      if (!profileRetry) {
        throw new Error("Profile not found for existing user");
      }
    }
    
    return {
      id: signInData.user.id,
      email: userConfig.email,
      password: userConfig.password,
    };
  }

  // If user doesn't exist, create it using admin API to bypass email confirmation
  const {
    data: { user },
    error: createError,
  } = await supabaseServiceClient.auth.admin.createUser({
    email: userConfig.email,
    password: userConfig.password,
    email_confirm: true, // Automatically confirm email
    user_metadata: {
      name: userConfig.name || userConfig.id,
    },
  });

  if (createError) {
    // Fallback to regular signup if admin create fails
    const {
      data: { user: signUpUser },
      error: signUpError,
    } = await supabase.auth.signUp({
      email: userConfig.email,
      password: userConfig.password,
      options: {
        data: {
          name: userConfig.name || userConfig.id,
        },
      },
    });

    if (signUpError) throw signUpError;
    if (!signUpUser) throw new Error("User creation failed");
    
    // Try to confirm using admin API
    await supabaseServiceClient.auth.admin.updateUserById(signUpUser.id, {
      email_confirm: true,
    }).catch(() => {
      // Ignore errors - email confirmation might be disabled
    });
    
    if (!signUpUser) throw new Error("User creation failed");
    
    // Wait for profile to be created by trigger
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify profile was created
    const { data: profile } = await supabaseServiceClient
      .from("profiles")
      .select("user_id")
      .eq("user_id", signUpUser.id)
      .single();
    
    if (!profile) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const { data: profileRetry } = await supabaseServiceClient
        .from("profiles")
        .select("user_id")
        .eq("user_id", signUpUser.id)
        .single();
      
      if (!profileRetry) {
        throw new Error("Profile was not created after user signup");
      }
    }

    console.log(`✅ Created test user: ${userConfig.email}`);
    return {
      id: signUpUser.id,
      email: userConfig.email,
      password: userConfig.password,
    };
  }

  if (!user) throw new Error("User creation failed");

  // Wait for profile to be created by trigger
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Verify profile was created
  const { data: profile } = await supabaseServiceClient
    .from("profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .single();
  
  if (!profile) {
    // If profile still doesn't exist, wait a bit more
    await new Promise(resolve => setTimeout(resolve, 1000));
    const { data: profileRetry } = await supabaseServiceClient
      .from("profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .single();
    
    if (!profileRetry) {
      throw new Error("Profile was not created after user signup");
    }
  }

  console.log(`✅ Created test user: ${userConfig.email}`);
  return {
    id: user.id,
    email: userConfig.email,
    password: userConfig.password,
  };
}

export async function cleanupTestUser(userId: string | undefined) {
  if (!userId) return;
  const { error } = await supabaseServiceClient.auth.admin.deleteUser(userId);
  if (error) {
    console.error(`❌ Failed to delete test user: ${userId}`, error);
  } else {
    console.log(`✅ Deleted test user: ${userId}`);
  }
}

export async function createTask(user: TestUser, title: string) {
  const randomString = Math.random().toString(36).substring(2, 14);
  const newTitle = `${title}-${randomString}`;

  // Sign in and verify session is established
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (signInError) {
    throw new Error(`Failed to sign in: ${signInError.message}`);
  }

  if (!signInData.session) {
    throw new Error("No session created after sign in");
  }

  // Small delay to ensure session is properly established
  await new Promise(resolve => setTimeout(resolve, 100));

  // Verify session is available
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Session not available after sign in");
  }

  // Verify user_id matches
  if (session.user.id !== user.id) {
    throw new Error(`Session user ID (${session.user.id}) does not match test user ID (${user.id})`);
  }

  return await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title: newTitle,
      description: "Test task",
    })
    .select();
}
