# Host the private probe in its actual consumer

Jake will not create or copy an App private key for shardfile. Keep the
public engine probe manual here. API-server5b322df adds its own manual
workflow: its ordinary repository token checks out itself, and both Git
dependencies are public. No App private key is needed on either side.
The API publication also fixes its inherited1005-socket pagination
fixture red by bounded writers, preserving all keys and assertions.
Remove the impossible private-checkout branch here rather than leave a
permanently failing manual job. Real API install assertions are moved,
not dropped. WS1 counts complete only after its actual hosted pass.
