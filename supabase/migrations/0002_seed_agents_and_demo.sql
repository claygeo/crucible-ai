-- Seed the 6 house agents.
-- This MUST stay in sync with src/lib/agents.ts.

insert into public.agents (id, name, persona, edge, model, synthetic, hue, daily_budget_usd, active)
values
  ('sage',     'Sage',     'Deliberative · base-rate-anchored',                'Reads the market, reasons from first principles, anchors to historical base rates before adjusting.', 'claude-opus-4-7',  false, 'teal',   1.0, true),
  ('hawk',     'Hawk',     'Contrarian · disagrees with consensus',            'Explicitly searches for the strongest case AGAINST the market consensus. Rewarded for finding mispricings.', 'claude-opus-4-7',  false, 'rose',   1.0, true),
  ('magpie',   'Magpie',   'Snap forecasts · speed over depth',                'Cheap, fast, short-context. Tests whether speed beats deliberation when news is scarce.', 'claude-sonnet-4-6', false, 'amber',  0.5, true),
  ('echo',     'Echo',     'Anchors to market price · small adjustments',      'Treats the prevailing market as the prior, makes only small Bayesian adjustments based on hard new info.', 'claude-haiku-4-5',  false, 'white',  0.2, true),
  ('mirror',   'Mirror',   'Cross-family control · GPT-5',                     'Different model family from a different lab. Tests whether reasoning transcends model architecture.', 'gpt-5',             false, 'indigo', 1.0, true),
  ('ensemble', 'Crowd',    'Uniform-weight ensemble · the wisdom of (AI) crowds', 'Equal-weighted average of all active agents. Tests whether AI ensembling beats any individual agent.', 'synthetic',         true,  'lime',   0.0, true)
on conflict (id) do update
  set name = excluded.name,
      persona = excluded.persona,
      edge = excluded.edge,
      model = excluded.model,
      synthetic = excluded.synthetic,
      hue = excluded.hue,
      daily_budget_usd = excluded.daily_budget_usd;

-- Initialize agent_elo rows for all agents at 1500.
insert into public.agent_elo (agent_id, rating)
select id, 1500 from public.agents
on conflict (agent_id) do nothing;

-- Initialize agent_stats stubs.
insert into public.agent_stats (agent_id, total_predictions, total_scored)
select id, 0, 0 from public.agents
on conflict (agent_id) do nothing;
