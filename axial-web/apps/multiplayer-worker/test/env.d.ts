declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {
    AXIAL_ROOM: Env["AXIAL_ROOM"];
  }
}
