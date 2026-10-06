import { Brandmark } from "@/components/home/Brandmark";
import { Camera } from "@/components/home/Camera";
import { Contact } from "@/components/home/Contact";
import { Intro } from "@/components/home/Intro";
import { Reviews } from "@/components/home/Reviews";
import { Footer } from "@/components/shell/Footer";
import { Showcase } from "@/components/home/Showcase";

export default function Home() {
  return (
    <main>
      <Intro />
      {/*
        Between the two sections rather than inside either: the headline is a
        fixed layer that starts in the hero and travels down into the showcase,
        so it cannot belong to a section that gets pinned and then scrolls away.
      */}
      <Brandmark />
      <Showcase />
      {/*
        The camera is sticky inside its own tall section, so it must come after
        anything that pins — a pinned ancestor and a sticky child measure against
        each other and the stick point drifts.
      */}
      <Camera />
      <Reviews />
      <Contact />
      <Footer />
    </main>
  );
}
