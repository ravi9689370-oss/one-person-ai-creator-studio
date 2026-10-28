import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AI Creator Studio",
    template: "%s · AI Creator Studio",
  },
  description:
    "The One-Person AI Creator Studio - an operating system for running a solo digital media business: planning, production, distribution, sales, and analytics.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1020",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('oc-theme');if(t==='dark'){document.documentElement.classList.add('dark')}else if(!t&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark')}}catch(e){}",
          }}
        />
      </head>
      <body>
        <script>0</script>
        {children}
      </body>
    </html>
  );
}
