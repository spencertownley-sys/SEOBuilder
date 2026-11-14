import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { currentUser } from "@/lib/session";
import { signUpAction } from "@/app/actions";

export const metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string; next?: string }> }) {
  if (await currentUser()) redirect("/app");
  const { error, notice, next } = await searchParams;
  return <AuthForm mode="signup" action={signUpAction} error={error} notice={notice} next={next ?? "/app/new"} />;
}
