# API Changelog

## 2026-03-05

- Фіналізовано Postman regression для режиму `Connect Local Repo`:
  - canonical колекція: `postman/collections/JM Showroomer - All Scenarios.postman_collection.json`
  - canonical environment: `postman/environments/JM_Showroomer_Environment__Template__Copy.postman_environment.json`
- Колекція приведена до стабільного `strict green` прогону:
  - додано collection-level pre-request для автозаповнення `auth_*` з `idToken_*`;
  - прибрано нестабільний smoke-фільтр `country=Ukraine` для lookbooks;
  - у id-залежних сценаріях додано контрактно-валідний `404` fallback (без false-fail у runner).
- Оновлено документацію для QA/розробки під canonical `postman/` workflow.
- `PATCH /users/profile` приведено до state-aware контракту:
  - до owner registration дозволені тільки `appLanguage` і `notificationsEnabled`;
  - після owner registration дозволені також `name`, `position`, `country`, `instagram`;
  - для pre-owner identity updates додано стабільний код `USER_PROFILE_FIELDS_FORBIDDEN`.
- Share showroom flow спрощено:
  - прибрано `web` fallback target з контракту;
  - `GET /share/showrooms/{id}` тепер описується тільки як mobile store fallback;
  - документація явно фіксує, що direct open app з HTTPS-share-link потребує `universal links / app links`.
- Total blocked-country policy посилено на public read path:
  - blocked-country lookbooks не віддаються через public detail;
  - blocked-country showrooms не віддаються через public detail/share;
  - owner country change для MVP1 блокується тільки через наявні showroom-и.

## 2026-03-04

- Рефактор документації: великий `README_DETAIL` розбитий на модульні технічні документи.
- Оновлено OpenAPI навігацію та зовнішні посилання.
- Додано production-level документи:
  - `API_VERSIONING_POLICY.md`
  - `OPERATIONAL_EXPECTATIONS.md`
- Додано Postman export для повного regression покриття:
  - `JM_Showroomer_All_Scenarios.postman_collection.json`
  - `JM_Showroomer_Environment.template.json`
- Посилено OpenAPI прикладами запитів/відповідей/помилок для критичних endpoint-ів.
