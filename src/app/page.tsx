import { redirect } from "next/navigation";
import { AudioLibraryApp } from "@/components/audio-library-app";
import { isRequestAuthenticated } from "@/lib/auth";

export default async function HomePage() {
  if (!await isRequestAuthenticated()) redirect("/login");
  return <AudioLibraryApp />;
}
