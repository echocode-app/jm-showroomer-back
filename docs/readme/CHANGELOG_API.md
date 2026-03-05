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
