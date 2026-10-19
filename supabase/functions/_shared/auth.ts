import { getUserClient } from "./supabaseClient.ts";

export interface AuthUser {
  id: string;
  email?: string;
}

export async function requireAuthUser(req: Request): Promise<AuthUser> {
  const userClient = getUserClient(req);
  const { data: { user }, error } = await userClient.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized: Valid Supabase session required");
  }

  return {
    id: user.id,
    email: user.email,
  };
}
