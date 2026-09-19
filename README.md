*[English](README.md) | [Deutsch](README.de.md)*

# Mercy SF Web Dashboard

A browser interface for [Mercy SF](https://mercysf.app). It runs the official
`mercy-cli` for you, one process per character, and shows what each of them is
doing: level, gold, mushrooms, the arena and dungeon counters, the legendary
dungeon, the hellevator, the world boss, the four class dungeons of the Class
World, which events are running, and whether the learned fight models have
arrived.

It changes nothing about the bot. Everything goes through the CLI, and the
equipment, guild, tavern and mail panels come from the game through
[sf-api](https://github.com/the-marenga/sf-api) by the-marenga.

> **Use at your own risk.** Automated play generally violates the Shakes &
> Fidget terms of service, and an account can be suspended for it, whether the
> automation runs through this dashboard or through the CLI directly. This
> dashboard is also under active development and will have bugs.

---

## Install it

On a fresh Debian or Ubuntu server, as root:

```bash
curl -fsSL https://raw.githubusercontent.com/SenseiIssei/MercySF_Dashboard/main/install.sh | bash
```

That is the whole installation. The script installs what it needs (Node.js,
Rust for the sf-api bridge, build tools, the Mercy SF CLI), creates a
self-signed certificate, and starts two services.

When it finishes, open:

```
https://<your-server-ip>:8080
```

Your browser will warn about the self-signed certificate. That is expected;
accept it and continue.

Running the script again updates the code and nothing else: accounts,
passwords, certificates and statistics stay as they are.

## Set it up

**1. Create the access.** The first page asks for a username and a password.
Make them up now: they are what you sign in to *this dashboard* with. They are
not your game account.

You are then shown two keys, once. The twelve words reset your password if you
ever forget it, and there is no other way back in, so put them somewhere safe.

**2. Add your game login.** Go to *Account Management*, enter your Shakes &
Fidget username and password, and the dashboard logs in once to find every
character on that login. Each one becomes a profile you can start on its own.

The password is stored encrypted on your server so that later starts need no
typing. It never reaches the browser and is never written in plain text.

**3. Start a character.** Press start next to it. The overview fills with live
data within a minute.

That is all. Everything below is optional.

---

## Optional

### More servers

One dashboard can run accounts on several machines. Each extra machine gets a
small node agent, without a web interface of its own:

```bash
curl -fsSL https://raw.githubusercontent.com/SenseiIssei/MercySF_Dashboard/main/install.sh | bash -s -- --node
```

It prints a pairing code, valid for fifteen minutes. Enter it under *Nodes* in
the dashboard together with the machine's address, and accounts can be moved
there.

### Randomizer

Decides by itself when each account plays: randomised hours, distribution
across your machines by priority, and a VPN profile per account. Off by
default.

### Learned fight models

Supporter licences receive fight models trained on real fights. The *Learned
models* card says whether they have arrived, and the *Apply the learned fight
model* setting decides whether a character uses them. Without a licence the bot
runs on the plain algorithms and says so.

---

## What it costs to run

Measured on a running installation with thirteen characters:

| | |
|---|---|
| Dashboard server | 130 MB, under 1 % of one core when idle |
| sf-api bridge | 14 MB |
| Each character | about 15 MB, one CLI process each |
| Thirteen characters | about 360 MB in total |

A small VPS or a Raspberry Pi 4 runs a handful of characters comfortably. Count
on roughly 150 MB plus 15 MB per character.

The pages stop polling while the tab is in the background, so a phone left open
in a pocket costs nothing.

---

## Language

The interface is available in English, German, Czech, Spanish, French, Italian,
Japanese, Polish, Russian and Chinese. Pick one in the top right; the setting
follows your account.

The names and explanations of the individual bot settings exist in German and
English. In every other language that page falls back to English.

## Something is wrong

* **The page has no styling, or a card says the CLI is too old.** The installed
  CLI is older than the dashboard expects. Update it in the sidebar under
  *MercySF CLI*.
* **A character will not start.** Check that the password is stored: *Account
  Management* shows it per login.
* **Equipment, guild, tavern and mail stay empty.** Those come from the sf-api
  bridge. `systemctl status mercy-sfapi-bridge` says whether it is running.
* **A card says the running bot holds the session.** One character can only be
  logged in once. The card retries by itself; the button forces it.

Errors and warnings from all characters collect behind the bell in the top
right.

---

## Credit and licence

This is a fork of [MercySF_Dashboard by dandulox](https://github.com/dandulox/MercySF_Dashboard),
which is the original work this builds on. Equipment data runs through
[sf-api](https://github.com/the-marenga/sf-api) by the-marenga. The bot itself
is [Mercy SF](https://mercysf.app).

Licensed under the AGPL-3.0, like the original. See [LICENSE](LICENSE).
