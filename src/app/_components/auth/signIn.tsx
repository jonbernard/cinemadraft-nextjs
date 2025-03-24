'use client';

import { SignInOptions, signIn } from 'next-auth/react';

export function SignIn() {
  const sendgridAction = (formData: FormData) => {
    signIn('sendgrid', formData as unknown as SignInOptions);
  };

  return (
    <form action={sendgridAction}>
      <label htmlFor="email-sendgrid">
        Email
        <input type="email" id="email-sendgrid" name="email" />
      </label>
      <input type="submit" value="Signin with Sendgrid" />
    </form>
  );
}
