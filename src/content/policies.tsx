// GENERIC TEMPLATE for a class project. Before real users sign up, have it reviewed (ideally by a
// lawyer) and make sure the app truly does what the text promises, for example the selfie deletion.
// Replace the example email addresses.
export const TERMS_VERSION = "2026-10-20"; // must match server/src/schemas.ts
export const POLICY_UPDATED = "October 20, 2026";

export function TermsOfUse() {
  return (
    <>
      <p>Welcome to SquadSync. By creating an account you agree to these terms. Please read them carefully.</p>

      <h3>1. Who can use SquadSync</h3>
      <ul>
        <li>You must be at least 18 years old.</li>
        <li>The information you give us must be true and kept up to date.</li>
        <li>One person, one account. Do not pretend to be someone else.</li>
      </ul>

      <h3>2. Keep your account safe</h3>
      <ul>
        <li>Choose a strong password you do not use anywhere else, and do not share it.</li>
        <li>Tell us right away if you think someone else has accessed your account.</li>
        <li>You are responsible for what happens under your account.</li>
      </ul>

      <h3>3. Be respectful</h3>
      <p>You agree not to:</p>
      <ul>
        <li>harass, threaten, bully, stalk or discriminate against anyone;</li>
        <li>post hateful, violent, sexual or illegal content;</li>
        <li>share another person's private information, photos or location without their consent;</li>
        <li>send spam, scams or promotions, or try to break, overload or reverse-engineer the service.</li>
      </ul>

      <h3>4. Meeting up safely</h3>
      <ul>
        <li>SquadSync helps friends plan outings. We do not supervise outings or run background checks.</li>
        <li>Identity verification confirms a selfie step was completed. It does not guarantee anyone's safety or character.</li>
        <li>When meeting people you do not know well, choose a public place, tell someone where you are going, arrange your own transport, and leave if you feel uncomfortable.</li>
        <li>If you are in danger, call 911 first.</li>
      </ul>

      <h3>5. Your content</h3>
      <ul>
        <li>You own what you post (profile details, suggestions, messages).</li>
        <li>You allow us to show it to the people in your Squads so the app can work.</li>
        <li>You promise you have the right to share it and that it follows these terms.</li>
      </ul>

      <h3>6. Venue and map information</h3>
      <p>Venue suggestions, hours, prices and directions are provided for convenience and may be out of date. Please confirm details before you go.</p>

      <h3>7. Identity verification</h3>
      <p>We may ask for a selfie to check that you are a real person. How we handle it is explained in our Privacy Policy.</p>

      <h3>8. Suspending or closing accounts</h3>
      <p>You can close your account at any time. We may suspend or remove accounts that break these terms or put others at risk.</p>

      <h3>9. Limits of our responsibility</h3>
      <p>SquadSync is provided "as is". To the extent allowed by law, we are not responsible for what happens during or after outings, for the conduct of other users, or for losses caused by outages or errors.</p>

      <h3>10. Changes</h3>
      <p>We may update these terms. If we make an important change, we will ask you to review and accept it again.</p>

      <h3>11. Governing law and contact</h3>
      <p>These terms are governed by the laws of Alberta, Canada. Questions? Email support@squadsync.example.</p>
    </>
  );
}

export function PrivacyPolicy() {
  return (
    <>
      <p>This policy explains what SquadSync collects, why, and the choices you have.</p>

      <h3>1. What we collect</h3>
      <ul>
        <li><strong>Account:</strong> email and password. The password is stored only as a one-way hash, so we cannot read it.</li>
        <li><strong>Profile:</strong> name, username, date of birth, city, travel distance, interests, and optionally phone, pronouns, bio and how you get around.</li>
        <li><strong>Availability:</strong> the times you mark as free.</li>
        <li><strong>Selfie:</strong> a photo for identity verification.</li>
        <li><strong>Activity:</strong> squads you join, activities you suggest, and your votes.</li>
        <li><strong>Technical:</strong> a session cookie and a security cookie, plus server logs (such as IP address) used to protect the service.</li>
      </ul>

      <h3>2. Why we use it</h3>
      <ul>
        <li>To create your account and run the app: squads, voting, scheduling and maps.</li>
        <li>To suggest venues and activities near you that match your interests.</li>
        <li>To check you are 18 or older and a real person.</li>
        <li>To keep the service secure and prevent abuse.</li>
      </ul>

      <h3>3. Who can see what</h3>
      <ul>
        <li>People in your Squads can see your name, username, age (never your birth date), interests, bio, pronouns and availability.</li>
        <li>Your phone number and selfie are never shown to other users.</li>
        <li>We do not sell your personal information.</li>
        <li>We use trusted providers (such as hosting, email and verification services) who may only use your data to serve us. We may also disclose information when the law requires it.</li>
      </ul>

      <h3>4. Your selfie</h3>
      <ul>
        <li>We collect it only with your clear consent, which is why you must accept this policy first.</li>
        <li>It is stored privately, only authorized reviewers can access it, and it is deleted within 30 days after verification.</li>
        <li>We do not use it for advertising or share it with other users.</li>
      </ul>

      <h3>5. Cookies and Google sign-in</h3>
      <p>We use only the cookies needed to keep you signed in and protect your account. We use no advertising cookies. If you choose Google sign-in, Google shares your email address and whether it is verified. Google may set its own cookies.</p>

      <h3>6. How long we keep data</h3>
      <p>We keep your information while your account is active. After you close it, we delete or anonymize your data within 30 days, except where the law requires us to keep something longer.</p>

      <h3>7. Security</h3>
      <p>We protect your data with encryption in transit, hashed passwords and limited access. No system is perfectly secure, so please use a strong, unique password.</p>

      <h3>8. Your rights</h3>
      <p>Under Alberta's PIPA and Canada's PIPEDA, you can ask to see the information we hold about you, correct it, withdraw your consent, or have your account deleted. You may also complain to the Office of the Privacy Commissioner of Canada or the Office of the Information and Privacy Commissioner of Alberta.</p>

      <h3>9. Age</h3>
      <p>SquadSync is for people 18 and older. We do not knowingly collect information from anyone younger.</p>

      <h3>10. Changes and contact</h3>
      <p>If we change this policy in a meaningful way, we will notify you and ask you to review it. Questions or requests? Email privacy@squadsync.example.</p>
    </>
  );
}