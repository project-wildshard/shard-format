# Name the private consumer install prerequisite

The engine install probe is public. api-server remains private, so a
workflow token scoped to shardfile cannot check it out. Its probe now
mints the existing org app token with read-only contents permission for
api-server alone, then uses it only for that checkout. Missing existing
APP_CLIENT_ID/APP_PRIVATE_KEY access is a named refusal, never a skip.
No credential is committed or created by this change. The coordinator
must grant this repository access to those existing org secrets before
WS1 can claim the hosted api-server install green. Local SSH cloning is
already available; no API-server source or pins change.
