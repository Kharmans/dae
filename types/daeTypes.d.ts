import API from "./module/API/api";
import { DAESystemDND5E } from "./module/Systems/DAEdnd5e";
import { DAESystem } from "./module/Systems/DAESystem";

declare global {
  var DAE: typeof API;
  var daeSystems: { dnd5e: DAESystemDND5E };
  interface CONFIG {
    DAE: {
      systemClass: typeof DAESystem;
    };
  }
}

declare module "fvtt-types/configuration" {
  interface ModuleConfig {
    dae: {
      api: typeof API;
    };
  }
}

export {};
