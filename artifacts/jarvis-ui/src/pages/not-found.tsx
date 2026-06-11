import { Layout } from "@/components/Layout";
  import { Link } from "wouter";

  export default function NotFound() {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
          <p className="text-8xl font-bold text-[rgba(0,212,255,0.2)] font-mono">404</p>
          <p className="text-xl font-bold text-white mt-4">Страница не найдена</p>
          <p className="text-muted-foreground text-sm mt-2 mb-8">Этой страницы не существует в JARVIS</p>
          <Link href="/" className="px-6 py-2.5 bg-[rgba(0,212,255,0.15)] hover:bg-[rgba(0,212,255,0.25)] border border-[rgba(0,212,255,0.3)] rounded-lg text-[#00d4ff] transition-all">
            На главную
          </Link>
        </div>
      </Layout>
    );
  }
  