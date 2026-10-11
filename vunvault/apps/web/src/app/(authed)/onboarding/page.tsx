import { OnboardingHero } from './_components/onboarding-hero';
import { OnboardingWizard } from './_components/onboarding-wizard';

/**
 * `/onboarding` (Task 64) — hero + the three-step wizard. Step 3's panel is
 * Task 65's `step-final.tsx` (a null stub until then); the submit flow is
 * wired there too. The layout owns the session guard, the staff redirect and
 * the marketing chrome.
 */
export default function OnboardingPage() {
  return (
    <>
      <OnboardingHero />
      <OnboardingWizard />
    </>
  );
}
