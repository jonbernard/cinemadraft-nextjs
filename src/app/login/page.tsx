import { Metadata } from 'next';

import { signIn } from '../../auth';

function SignIn() {
  return (
    <form
      action={async (formData) => {
        'use server';

        await signIn('sendgrid', formData);
      }}
    >
      <input type="text" name="email" placeholder="Email" />
      <button type="submit">Signin with Sendgrid</button>
    </form>
  );
}

export const metadata: Metadata = {
  title: 'Login',
};

export default function Page() {
  return (
    <>
      <div>login</div>
      <SignIn />
    </>
  );
}
