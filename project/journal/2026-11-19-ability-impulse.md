# Ability impulse and aim height (opus-of-close, ONE-FORMAT OF20c1)

- A species ability row may now say `effect: 'impulse'` with `strength` (m/s along the strike's
  facing, at most 40) and `lift` (m/s up), and `aimHeight` (metres above the target's feet).
- Why: Sky Reach's Storm Roc moves onto the declared path (OF20c). Its gale wall throws the
  player (14 m/s, lift 2) and its stoop dives at the chest (1.2 m); only the borrowed decision
  row's `strikeEffects` could say so, so the declared host dropped both. One push field
  (`effect`) keeps knockback and impulse in one place.
