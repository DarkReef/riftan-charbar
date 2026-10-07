# Riftan Charbar 0.1.1

Отдельный модуль Foundry VTT 14 для Apex Heresy (`dark-heresy`, версия 1.4.2+ с API v1). Панель персонажей, состояния и запросы проверок. Item Piles и ItemPileFFG для основной работы не нужны.

## Установка

В Setup → Add-on Modules → Install Module вставьте:

```text
https://github.com/DarkReef/riftan-charbar/releases/latest/download/module.json
```

После установки включите Riftan Charbar в настройках модулей мира. Откройте кнопкой с людьми в инструментах токенов либо макросом:

```js
game.modules.get('riftan-charbar').api.open();
```

Панель показывает ранения, критические ранения, усталость, судьбу и состояния. Мастер отмечает участников, запрашивает проверку характеристики/обычного навыка, задаёт модификатор и причину. Игроки отвечают за своих персонажей кнопками в чате. Ответы сохраняются, первый допустимый ответ включается в сводку. Запрос можно закрыть. Видимость результатов следует режиму броска; скрытые ответы не раскрываются в общей сводке.

```js
await game.modules.get('riftan-charbar').api.requestChecks({
  actorUuids: canvas.tokens.controlled.map(t => t.actor.uuid),
  characteristic: 'agility', modifier: 10, reason: 'Перепрыгнуть траншею'
});
```

При включённом ItemPileFFG в панели появляются дополнительные кнопки инвентаря и подготовки торговца. Это необязательная интеграция через публичный API второго модуля. Специализации и противоборства отдельным запросом пока не поддерживаются.

## Разработка

Исходники модуля находятся в этом репозитории. Проверки: `npm test`. Модуль имеет собственные языковые файлы, CSS, пространство флагов и API; он не импортирует код второго пакета или файлы из `systems/`.

Версия 0.1.1 содержит актуальную инструкцию публичной установки; механика панели не менялась. Проверены автоматические тесты и DOM с имитацией Foundry; реальный мир Foundry 14 с мастером и игроком ещё не проверен. Броски клиентов и их локальные очереди не являются серверной блокировкой одновременных действий.

Основано на коде Apex Heresy, автор Apex; выделение и доработка — DarkReef. Лицензия GPL-3.0, полный текст в `LICENSE`. Исходники опубликованы вместе с релизом в этом репозитории.


## Independent development

Run `npm test` in this repository. The system is installed separately.
The manual release workflow creates a draft release with this module only.
Live multiplayer validation against the new system build is still pending.

## Установка из публичного репозитория

В Foundry → Add-on Modules → Install Module вставьте URL манифеста:

```text
https://github.com/DarkReef/riftan-charbar/releases/latest/download/module.json
```

Манифест и ZIP доступны без авторизации. Для обновления используйте штатную проверку обновлений Foundry. Рекомендуемая система — Apex Heresy RU 1.5.3; система устанавливается отдельно.

## Поддержка проекта

[План поддержки, совместимость и ограничения проверок](docs/maintenance.md).
