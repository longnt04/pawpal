import TopBar from "@/components/TopBar";
import GlobalCallNotification from "@/components/GlobalCallNotification";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TopBar />
      {children}
      <GlobalCallNotification />
    </>
  );
}
