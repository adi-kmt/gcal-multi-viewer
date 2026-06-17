import './globals.css';

export const metadata = {
  title: 'Multi Google Calendar Viewer',
  description: 'Personal multi-account Google Calendar viewer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
