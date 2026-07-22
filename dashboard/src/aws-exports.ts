const awsConfig = {
  Auth: {
    Cognito: {
      region: "us-east-1",
      userPoolId: "us-east-1_xMxnEsRE1",
      userPoolClientId: "46omt8288p2hjj4ombfv8oli17",
      loginWith: {
        username: true,
      },
    },
  },
};

export default awsConfig;