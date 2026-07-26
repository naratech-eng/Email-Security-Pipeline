/** Map an Amplify/Cognito error to a concise, user-facing message. */
export function authErrorMessage(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  const name =
    typeof err === 'object' && err && 'name' in err
      ? String((err as { name: unknown }).name)
      : '';
  const message =
    typeof err === 'object' && err && 'message' in err
      ? String((err as { message: unknown }).message)
      : '';

  switch (name) {
    case 'UserNotFoundException':
    case 'NotAuthorizedException':
      return 'Incorrect email or password.';
    case 'UserNotConfirmedException':
      return 'Your email isn’t verified yet — check your inbox for the code.';
    case 'UsernameExistsException':
      return 'An account with this email already exists.';
    case 'CodeMismatchException':
      return 'That code is incorrect. Check it and try again.';
    case 'ExpiredCodeException':
      return 'That code has expired — request a new one.';
    case 'LimitExceededException':
      return 'Too many attempts. Wait a moment and try again.';
    case 'InvalidPasswordException':
      return 'Password doesn’t meet the requirements.';
    case 'InvalidParameterException':
      return message || 'Please check the details you entered.';
    default:
      return message || fallback;
  }
}
