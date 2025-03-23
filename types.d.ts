/* eslint-disable no-var, @typescript-eslint/no-explicit-any */

declare global {
  var prisma: any;  
}

declare global {
  interface GlobalThis {
    prisma: any;
  }
}