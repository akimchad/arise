import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Logo } from "../components/Brand";
import { AuthForm } from "../components/AuthForm";
import { useAuth } from "../lib/auth";

export default function Auth({ mode }: { mode: "login" | "signup" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/studio";
  useEffect(() => { if (user) navigate(next, { replace: true }); }, [user, next, navigate]);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">
          <h1 className="display text-[52px]">{mode === "login" ? "Welcome back." : "Let's get you posting."}</h1>
          <p className="mb-8 mt-4 text-[17px] text-ink/70">Your brand, your ideas and every creative you've made — in one place.</p>
          <AuthForm initialMode={mode} onDone={() => navigate(next, { replace: true })} />
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-sage lg:block">
        <img src="/showcase/philz-post.jpg" alt="" className="absolute left-[10%] top-[12%] w-[46%] rotate-[-5deg] rounded-[22px] shadow-lift" />
        <img src="/showcase/tartine-post.jpg" alt="" className="absolute right-[8%] top-[24%] w-[40%] rotate-[4deg] rounded-[22px] border-[6px] border-paper shadow-lift" />
        <img src="/showcase/bluebottle-story.jpg" alt="" className="absolute bottom-[-6%] left-[30%] w-[32%] rotate-[2deg] rounded-[22px] shadow-lift" />
        <p className="absolute bottom-6 right-8 text-[11px] text-ink/50">Concept examples · not affiliated</p>
      </div>
    </div>
  );
}
