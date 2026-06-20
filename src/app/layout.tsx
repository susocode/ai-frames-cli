import type { Metadata } from 'next'
import { ThemeProvider } from '@/theme/ThemeContext'
import { LangProvider } from '@/i18n/LangContext'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'ai-frames',
  description: 'AI context manager for multi-repo workspaces',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        {/* Prevent flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('ai-frames_theme');
            if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
          } catch(e) {}
        ` }} />
      </head>
      <body>
        <ThemeProvider>
          <LangProvider>
            {children}
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
