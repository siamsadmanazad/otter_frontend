interface SignInData {
    email: string;
    password: string;
    rememberMe?: boolean;
  }

interface SignUpData {
    fullName: string;
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
    agreeToTerms: boolean;
}

export {
    SignInData,
    SignUpData,

}
