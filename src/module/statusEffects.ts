const ACTIVE_EFFECT_MODES = {
  CUSTOM: 0,
  MULTIPLY: 1,
  ADD: 2,
  DOWNGRADE: 3,
  UPGRADE: 4,
  OVERRIDE: 5
};

export let DAEStatusEffects = [
  {
    id: "dead",
    label: "EFFECT.StatusDead",
    icon: "icons/svg/skull.svg",
    changes: [
      {
        key: "data.attributes.speed.value",
        mode: ACTIVE_EFFECT_MODES.OVERRIDE,
        priority: 50,
        value: "0 FT"
      }
    ],
    flags: {dae: {statusId:"death"}}
  },
  {
    id: "unconscious",
    label: "EFFECT.StatusUnconscious",
    icon: "icons/svg/unconscious.svg",
    flags: {dae: {statusId: "unconscious"}}
  },
  {
    id: "sleep",
    label: "EFFECT.StatusAsleep",
    icon: "icons/svg/sleep.svg",
    flags: {dae: {statusId:"sleep"}}
  },
  {
    id: "stun",
    label: "EFFECT.StatusStunned",
    icon: "icons/svg/daze.svg",
    flags: {dae: {statusId:"stunned"}}
  },
  {
    id: "prone",
    label: "EFFECT.StatusProne",
    icon: "icons/svg/falling.svg",
    flags: {dae: {statusId:"prone"}}

  },
  {
    id: "restrain",
    label: "EFFECT.StatusRestrained",
    icon: "icons/svg/net.svg",
    flags: {dae: {statusId:"restrained"}}
  },
  {
    id: "paralysis",
    label: "EFFECT.StatusParalysis",
    icon: "icons/svg/paralysis.svg",
    flags: {dae: {statusId:"paralyzed"}}
  },
  {
    id: "petrified",
    label: "EFFECT.StatusParalysis",
    icon: "icons/svg/paralysis.svg",
    flags: {dae: {statusId:"petrified"}}
  },
  {
    id: "fly",
    label: "EFFECT.StatusFlying",
    icon: "icons/svg/wing.svg",
    flags: {dae: {statusId:"flying"}}
  },
  {
    id: "blind",
    label: "EFFECT.StatusBlind",
    icon: "icons/svg/blind.svg",
    flags: {dae: {statusId:"blinded"}}
  },
  {
    id: "deaf",
    label: "EFFECT.StatusDeaf",
    icon: "icons/svg/deaf.svg",
    flags: {dae: {statusId:"deafened"}}
  },
  {
    id: "silence",
    label: "EFFECT.StatusSilenced",
    icon: "icons/svg/silenced.svg",
    flags: {dae: {statusId:"silenced"}}
  },
  {
    id: "fear",
    label: "EFFECT.StatusFear",
    icon: "icons/svg/terror.svg",
    flags: {dae: {statusId:"frightened"}}
  },
  {
    id: "burning",
    label: "EFFECT.StatusBurning",
    icon: "icons/svg/fire.svg"
  },
  {
    id: "frozen",
    label: "EFFECT.StatusFrozen",
    icon: "icons/svg/frozen.svg"
  },
  {
    id: "shock",
    label: "EFFECT.StatusShocked",
    icon: "icons/svg/lightning.svg"
  },
  {
    id: "corrode",
    label: "EFFECT.StatusCorrode",
    icon: "icons/svg/acid.svg"
  },
  {
    id: "bleeding",
    label: "EFFECT.StatusBleeding",
    icon: "icons/svg/blood.svg"
  },
  {
    id: "disease",
    label: "EFFECT.StatusDisease",
    icon: "icons/svg/biohazard.svg",
    flags: {dae: {statusId:"diseased"}}
  },
  {
    id: "poison",
    label: "EFFECT.StatusPoison",
    icon: "icons/svg/poison.svg",
    flags: {dae: {statusId:"poisoned"}}
  },
  {
    id: "radiation",
    label: "EFFECT.StatusRadiation",
    icon: "icons/svg/radiation.svg"
  },
  {
    id: "regen",
    label: "EFFECT.StatusRegen",
    icon: "icons/svg/regen.svg"
  },
  {
    id: "degen",
    label: "EFFECT.StatusDegen",
    icon: "icons/svg/degen.svg"
  },
  {
    id: "upgrade",
    label: "EFFECT.StatusUpgrade",
    icon: "icons/svg/upgrade.svg"
  },
  {
    id: "downgrade",
    label: "EFFECT.StatusDowngrade",
    icon: "icons/svg/downgrade.svg"
  },
  {
    id: "target",
    label: "EFFECT.StatusTarget",
    icon: "icons/svg/target.svg"
  },
  {
    id: "eye",
    label: "EFFECT.StatusMarked",
    icon: "icons/svg/eye.svg"
  },
  {
    id: "curse",
    label: "EFFECT.StatusCursed",
    icon: "icons/svg/sun.svg"
  },
  {
    id: "bless",
    label: "EFFECT.StatusBlessed",
    icon: "icons/svg/angel.svg"
  },
  {
    id: "fireShield",
    label: "EFFECT.StatusFireShield",
    icon: "icons/svg/fire-shield.svg"
  },
  {
    id: "coldShield",
    label: "EFFECT.StatusIceShield",
    icon: "icons/svg/ice-shield.svg"
  },
  {
    id: "magicShield",
    label: "EFFECT.StatusMagicShield",
    icon: "icons/svg/mage-shield.svg"
  },
  {
    id: "holyShield",
    label: "EFFECT.StatusHolyShield",
    icon: "icons/svg/holy-shield.svg"
  },
];

// sleep? - no condition
// grappled
//exhaustion
// invisible