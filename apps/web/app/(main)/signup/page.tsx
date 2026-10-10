import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { currentUser } from "@/lib/session";
import { signUpAction } from "@/app/actions";

export const metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  if (await currentUser()) redirect("/app");
  const { error, next } = await searchParams;
  return <AuthForm mode="signup" action={signUpAction} error={error} next={next ?? "/app/new"} />;
}
