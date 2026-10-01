/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user: import('./parts/accounts/auth.mjs').User | null;
  }
}
