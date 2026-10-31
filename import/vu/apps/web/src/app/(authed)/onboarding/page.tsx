import { OnboardingHero } from './_components/onboarding-hero';
import { OnboardingWizard } from './_components/onboarding-wizard';

/**
 * `/onboarding` — hero + the three-step wizard. Step 3's panel is
 * an earlier iteration's `step-final.tsx` (a null stub until then); the submit flow is
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
