# Azure Isekai

Azure Isekai is a web RPG for hands-on Azure learning. NPCs assign
infrastructure tasks, the grading service validates student-owned Azure
resources, and the game records progress and rewards.

This repository contains:

- the static RPG Maker frontend;
- Microsoft Entra sign-in routes for Azure Static Web Apps;
- server-side Azure Functions proxies under `api/`;
- subscription registration and player-progress pages.
- an operator-only teacher dashboard at `admin.html`.

The browser never receives backend Function keys or chooses the grading
identity. The Static Web Apps API derives the signed-in email from the trusted
client principal and sends a short-lived signed assertion to the grading
Function.

The teacher dashboard requires the signed-in address in the server-side
`ADMIN_EMAILS` allowlist at both the proxy and backend. Teachers can create
owned classes, import CSV rosters, view live class/task/student performance,
export filtered CSV results, and use controlled cache and registration support
tools without exposing backend keys or unrestricted student browsing.


## Demo

[![#Azure Isekai (Alpha) - free #aks #rpggame](https://img.youtube.com/vi/dIwNWwz681k/0.jpg)](https://youtu.be/dIwNWwz681k)

## Development

This game was created using [RPG Maker](https://www.rpgmakerweb.com/), with a
custom plugin, `NpcK8sPluginCommand.js`, under `js/plugins`.
You can modify the game within RPG Maker. To enable non-player characters (NPCs) to interact with the grader API, you must configure the Plugin Command.

## Configure an NPC Plugin Command

1. **Open the NPC Editor:** Right-click the NPC and select "Edit" from the context menu.
2. **Access Plugin Commands:** Within the NPC Editor, click the "Plugin Command" button.
3. **Define the Plugin Command:** Enter the desired command in the provided field. Ensure the command includes the unique NPC name as defined in the `NpcBackgroundTable`.

## Local Development

Use Node.js 24.19 or newer and Azure Static Web Apps CLI 2.x:

```bash
npm install --global @azure/static-web-apps-cli@2
npm install
cd api && npm install && cd ..
npm run dev
```

`npm run dev` starts the Static Web Apps emulator with the local API. Configure
the emulator's authentication identity and server-side backend settings; do
not put Function keys, proxy-signing keys, or student emails in browser query
parameters.

Production is deployed by the grading-engine repository's
`Infrastructure/deploy-static-web-app.sh`, which supplies the complete
server-side settings map.

The `api/` directory is deployed as the Static Web Apps managed Node API. Azure
Portal API mapping (Bring Your Own API/linked backend) is intentionally empty;
do not link the grading Function App directly. Production deployment verifies
the managed API through `/api/health` and fails if it is unavailable.

## Core Developers

Students from [Higher Diploma in Cloud and Data Centre Administration](https://www.vtc.edu.hk/admission/en/programme/it114115-higher-diploma-in-cloud-and-data-centre-administration/)

- [錢弘毅](https://www.linkedin.com/in/hongyi-qian-a71b17290/)
- [Ho Chun Sun Don (何俊申)](https://www.linkedin.com/in/ho-chun-sun-don-%E4%BD%95%E4%BF%8A%E7%94%B3-660a94290/)
- [Kit Fong Loo](https://www.linkedin.com/in/kit-fong-loo-910482347/)
- [Yuehan WU](https://www.linkedin.com/in/yuehan-wu-a40612290/)
