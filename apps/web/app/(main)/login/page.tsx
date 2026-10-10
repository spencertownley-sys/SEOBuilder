import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { currentUser } from "@/lib/session";
import { logInAction } from "@/app/actions";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  if (await currentUser()) redirect("/app");
  const { error, next } = await searchParams;
  return <AuthForm mode="login" action={logInAction} error={error} next={next} />;
}
