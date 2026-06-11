import { Toaster as Sonner } from "sonner";
  export function Toaster() {
    return (
      <Sonner
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "hsl(220 50% 7%)",
            border: "1px solid rgba(0,212,255,0.2)",
            color: "hsl(210 40% 98%)",
          },
        }}
      />
    );
  }
  