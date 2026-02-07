/* eslint-disable no-console */

// ==================================================
// HaxFenx x4 [beta] - Headless Haxball (Single File)
// ==================================================

// ----------------------
// CONFIGURACION GENERAL
// ----------------------
const HBInit = globalThis.HBInit || require("haxball-headless");
const HEADLESS_TOKEN = "PASTE_HEADLESS_TOKEN_HERE";
const ROOM_NAME = "HaxFenx x4 [beta]";
const MAX_PLAYERS = 16;
const PUBLIC_ROOM = true;
const NO_PLAYER = true;
const GEO = { code: "CO", lat: 4.711, lon: -74.0721 };
const MAINTENANCE_PASSWORD = "CAMBIA_ESTA_CLAVE";

// ----------------------
// ROLES Y PERMISOS
// ----------------------
const OWNER_ABSOLUTO_AUTH = "XRb9Q6F45Vs-SxVoJCmrbx9M31oLDl5I9wAKoGb2ViA";
const OWNER_AUTHS = [];
const MASTER_AUTHS = [];
const ADMIN_AUTHS = [];
const VIP_AUTHS = [];

// ----------------------
// COLORES / UTILS
// ----------------------
const COLORS = {
  aqua: 0x00ffcc,
  red: 0xff4d4d,
  yellow: 0xffc857,
  green: 0x4caf50
};

function announce(room, message, targetId, color = COLORS.yellow, style = "normal", sound = 0) {
  room.sendAnnouncement(message, targetId, color, style, sound);
}

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// ----------------------
// RANGOS / XP / MONEDAS
// ----------------------
const RANKS = [
  { minXp: 10000, label: "🦅 Top Global" },
  { minXp: 8000, label: "♨️ Icono" },
  { minXp: 6000, label: "🌌 Astral" },
  { minXp: 4000, label: "👽 Extraterrestre" },
  { minXp: 2500, label: "🎖️ Maestro" },
  { minXp: 1500, label: "🪄 Mago" },
  { minXp: 1000, label: "🥊 Profesional" },
  { minXp: 400, label: "🥇 Amateur" },
  { minXp: 100, label: "🥈 Cadete" },
  { minXp: 0, label: "🥉 Juvenil" },
  { minXp: -10, label: "💩 Down" },
  { minXp: -50, label: "🐒 Mono" },
  { minXp: -100, label: "🤡 westcol" },
  { minXp: -200, label: "🧱 Icono cacal" },
  { minXp: -500, label: "👽 Tonto Universal" }
];

const XP_VALUES = {
  goal: 20,
  win: 25,
  assist: 10,
  cleanSheet: 15,
  ownGoal: -10,
  insult: -10
};

const COIN_VALUES = {
  play: 5,
  win: 10,
  cleanSheet: 5
};

const playerStats = new Map();

function getPlayerKey(player) {
  return player.auth || player.name;
}

function getStats(player) {
  const key = getPlayerKey(player);
  if (!playerStats.has(key)) {
    playerStats.set(key, {
      xp: 0,
      goals: 0,
      assists: 0,
      wins: 0,
      cleanSheets: 0,
      coins: 0,
      vipGranted: false
    });
  }
  return playerStats.get(key);
}

function getRank(xp) {
  for (const rank of RANKS) {
    if (xp >= rank.minXp) return rank.label;
  }
  return RANKS[RANKS.length - 1].label;
}

function addXp(player, amount) {
  const stats = getStats(player);
  stats.xp += amount;
  return stats;
}

function addCoins(player, amount) {
  const stats = getStats(player);
  stats.coins += amount;
  return stats;
}

function isVip(player) {
  return player.auth === OWNER_ABSOLUTO_AUTH || VIP_AUTHS.includes(player.auth) || getStats(player).xp >= 1000;
}

function grantVipBonusIfNeeded(player, room) {
  const stats = getStats(player);
  if (isVip(player) && !stats.vipGranted) {
    stats.vipGranted = true;
    stats.coins += 100;
    announce(room, "VIP: +100 monedas.", player.id, COLORS.yellow);
  }
}

// ----------------------
// PERMISOS
// ----------------------
function isOwnerAbsoluto(player) {
  return player.auth === OWNER_ABSOLUTO_AUTH;
}

function isOwner(player) {
  return OWNER_AUTHS.includes(player.auth) || isOwnerAbsoluto(player);
}

function isMaster(player) {
  return MASTER_AUTHS.includes(player.auth) || isOwner(player);
}

function isAdmin(player) {
  return ADMIN_AUTHS.includes(player.auth) || isMaster(player);
}

function getRoleLabel(player) {
  if (isOwnerAbsoluto(player)) return "🐐 | Kern3l goat";
  if (isMaster(player)) return "🔥 Master pro max";
  if (isOwner(player)) return "🍁 Owner";
  if (isAdmin(player)) return "🛡️ Admin";
  if (isVip(player)) return "💎 VIP";
  return null;
}

// ----------------------
// ANTI SPAM / COOLDOWN
// ----------------------
const cooldowns = new Map();
const chatSpam = new Map();
const joinSpam = [];

function checkCooldown(playerId, command, seconds) {
  const key = `${playerId}:${command}`;
  const now = Date.now();
  const last = cooldowns.get(key) || 0;
  if (now - last < seconds * 1000) return false;
  cooldowns.set(key, now);
  return true;
}

function checkSpam(player) {
  const now = Date.now();
  const history = chatSpam.get(player.id) || [];
  const recent = history.filter((time) => now - time < 2000);
  recent.push(now);
  chatSpam.set(player.id, recent);
  return recent.length <= 4;
}

function handleJoinFlood() {
  const now = Date.now();
  joinSpam.push(now);
  while (joinSpam.length && now - joinSpam[0] > 10000) {
    joinSpam.shift();
  }
  if (joinSpam.length > 8) {
    log("join-flood", `Joins in 10s: ${joinSpam.length}`);
  }
}

// ----------------------
// AFK
// ----------------------
const activityMap = new Map();
const AFK_LIMIT_SECONDS = 120;

function updateActivity(player) {
  activityMap.set(player.id, Date.now());
}

// ----------------------
// VOTEKICK
// ----------------------
const voteKick = {
  active: false,
  targetId: null,
  voters: new Set(),
  timeout: null
};

function resetVoteKick() {
  if (voteKick.timeout) clearTimeout(voteKick.timeout);
  voteKick.active = false;
  voteKick.targetId = null;
  voteKick.voters = new Set();
  voteKick.timeout = null;
}

function startVoteKick(room, player, target) {
  resetVoteKick();
  voteKick.active = true;
  voteKick.targetId = target.id;
  voteKick.voters.add(player.id);
  announce(room, `Votekick iniciado contra ${target.name}. Usa !votekick ${target.id}`, null, COLORS.yellow);
  voteKick.timeout = setTimeout(() => {
    announce(room, "Votekick expirado.", null, COLORS.red);
    resetVoteKick();
  }, 20000);
}

function handleVoteKick(room, player, targetId) {
  const target = room.getPlayer(targetId);
  if (!target) {
    announce(room, "ID inválido.", player.id, COLORS.red);
    return;
  }
  if (isOwnerAbsoluto(target)) {
    announce(room, "No puedes votar contra el Owner absoluto.", player.id, COLORS.red);
    return;
  }
  if (!voteKick.active) {
    startVoteKick(room, player, target);
    return;
  }
  if (voteKick.targetId !== target.id) {
    announce(room, "Ya hay un votekick activo.", player.id, COLORS.red);
    return;
  }
  if (voteKick.voters.has(player.id)) {
    announce(room, "Ya votaste.", player.id, COLORS.red);
    return;
  }
  voteKick.voters.add(player.id);
  const players = room.getPlayerList().filter((p) => p.id !== 0);
  const needed = Math.max(2, Math.ceil(players.length * 0.6));
  announce(room, `Votos: ${voteKick.voters.size}/${needed}`, null, COLORS.yellow);
  if (voteKick.voters.size >= needed) {
    announce(room, `${target.name} fue expulsado por votekick.`, null, COLORS.yellow);
    room.kickPlayer(target.id, "Votekick", false);
    resetVoteKick();
  }
}

// ----------------------
// SISTEMA DE PICK x4
// ----------------------
const pickState = {
  active: false,
  currentCaptainId: null,
  pickList: [],
  captains: { red: null, blue: null },
  nextPickFrom: null
};

function resetPick() {
  pickState.active = false;
  pickState.currentCaptainId = null;
  pickState.pickList = [];
  pickState.captains = { red: null, blue: null };
  pickState.nextPickFrom = null;
}

function refreshCaptains(room) {
  const redCaptain = room.getPlayerList().find((p) => p.team === 1 && p.id !== 0);
  const blueCaptain = room.getPlayerList().find((p) => p.team === 2 && p.id !== 0);
  pickState.captains.red = redCaptain ? redCaptain.id : null;
  pickState.captains.blue = blueCaptain ? blueCaptain.id : null;
}

function startPick(room, losingTeam) {
  pickState.active = true;
  pickState.pickList = room
    .getPlayerList()
    .filter((p) => p.team === 0 && p.id !== 0)
    .map((p) => ({ id: p.id, name: p.name }));

  refreshCaptains(room);
  pickState.nextPickFrom = losingTeam === 1 ? "red" : "blue";
  pickState.currentCaptainId = pickState.captains[pickState.nextPickFrom];

  if (!pickState.currentCaptainId || pickState.pickList.length === 0) {
    resetPick();
    return;
  }

  sendPickList(room);
}

function sendPickList(room) {
  const captainId = pickState.currentCaptainId;
  if (!captainId) return;

  announce(room, "Selecciona por número:", captainId, COLORS.yellow, "bold");
  pickState.pickList.forEach((player, index) => {
    announce(room, `[${index + 1}] ${player.name}`, captainId, COLORS.yellow);
  });
}

function switchPickTurn(room) {
  if (pickState.pickList.length === 0) {
    resetPick();
    return;
  }
  pickState.currentCaptainId =
    pickState.currentCaptainId === pickState.captains.red ? pickState.captains.blue : pickState.captains.red;
  sendPickList(room);
}

function handleCaptainPick(room, player, message, forced = false) {
  if (!forced && (!pickState.active || player.id !== pickState.currentCaptainId)) return false;

  const pickIndex = Number(message.trim());
  if (!Number.isFinite(pickIndex) || pickIndex < 1 || pickIndex > pickState.pickList.length) {
    announce(room, "Número inválido.", player.id, COLORS.red);
    return true;
  }

  const chosen = pickState.pickList.splice(pickIndex - 1, 1)[0];
  const team = pickState.currentCaptainId === pickState.captains.red ? 1 : 2;
  setTeam(room, chosen.id, team);
  switchPickTurn(room);
  return true;
}

// ----------------------
// CONTROL DE TEAMS
// ----------------------
const allowedTeamChange = new Set();
const lastTeam = new Map();

function setTeam(room, playerId, team) {
  allowedTeamChange.add(playerId);
  room.setPlayerTeam(playerId, team);
  lastTeam.set(playerId, team);
}

function handleTeamChange(room, player) {
  const prev = lastTeam.get(player.id);
  if (allowedTeamChange.has(player.id)) {
    allowedTeamChange.delete(player.id);
    lastTeam.set(player.id, player.team);
    return;
  }
  if (prev !== undefined && prev !== player.team) {
    setTeam(room, player.id, prev);
  } else {
    lastTeam.set(player.id, player.team);
  }
}

// ----------------------
// INSULTOS / XP NEGATIVO
// ----------------------
const INSULTS = ["insulto1", "insulto2", "puta", "mierda", "hp", "pendejo"]; // editar lista

function containsInsult(text) {
  const lower = text.toLowerCase();
  return INSULTS.some((word) => lower.includes(word));
}

// ----------------------
// ROOM SETUP
// ----------------------
if (typeof HBInit !== "function") {
  console.error("HBInit no está definido. Instala haxball-headless y ejecuta: node index.js");
} else {
  const room = HBInit({
    roomName: ROOM_NAME,
    maxPlayers: MAX_PLAYERS,
    public: PUBLIC_ROOM,
    geo: GEO,
    noPlayer: NO_PLAYER,
    token: HEADLESS_TOKEN
  });

  room.setDefaultStadium("Big");
  room.setScoreLimit(3);
  room.setTimeLimit(5);

  const teamTouches = {
    1: { last: null, prev: null },
    2: { last: null, prev: null }
  };

  function recordTouch(player) {
    if (!player || player.team === 0) return;
    const scores = room.getScores();
    const time = scores ? scores.time : 0;
    const teamData = teamTouches[player.team];
    teamData.prev = teamData.last;
    teamData.last = { id: player.id, time };
  }

  function resetTouches() {
    teamTouches[1] = { last: null, prev: null };
    teamTouches[2] = { last: null, prev: null };
  }

  function sendWelcome(player) {
    announce(
      room,
      "Bienvenido a HaxFenx x4 [beta]\nesperamos que disfrutes tu estancia por aqui\nby syntaxxx.gg",
      player.id,
      COLORS.aqua,
      "bold"
    );
  }

  function rotateTeamsAfterGame(winningTeam) {
    const losingTeam = winningTeam === 1 ? 2 : 1;
    const winners = room.getPlayerList().filter((p) => p.team === winningTeam);
    const losers = room.getPlayerList().filter((p) => p.team === losingTeam);

    losers.forEach((p) => setTeam(room, p.id, 0));
    winners.forEach((p) => setTeam(room, p.id, 1));

    const oppositeTeam = winningTeam === 1 ? 2 : 1;
    room.getPlayerList().forEach((p) => {
      if (p.team === oppositeTeam) setTeam(room, p.id, 0);
    });

    startPick(room, losingTeam);
  }

  function showStats(player) {
    const stats = getStats(player);
    const rank = getRank(stats.xp);
    const role = getRoleLabel(player);
    const roleText = role ? `${role} | ` : "";
    announce(
      room,
      `${roleText}${rank} | XP: ${stats.xp} | Goles: ${stats.goals} | Asist: ${stats.assists} | Wins: ${stats.wins} | Monedas: ${stats.coins}`,
      player.id,
      COLORS.yellow
    );
  }

  function showHelp(player) {
    announce(room, "COMANDOS DISPONIBLES:", player.id, COLORS.yellow, "bold");
    [
      "!bb",
      "!banana",
      "!calladmin",
      "!dc",
      "!mostrarstats",
      "!sub me",
      "!money",
      "!rangos",
      "!inc <texto>",
      "!votekick <player>",
      "!8ball <pregunta>",
      "!afk"
    ].forEach((cmd) => announce(room, `• ${cmd}`, player.id, COLORS.yellow));
  }

  function showRanks(player) {
    announce(
      room,
      "Rangos: 🥉 Juvenil, 🥈 Cadete, 🥇 Amateur, 🥊 Profesional, 🪄 Mago, 🎖️ Maestro, 👽 Extraterrestre, 🌌 Astral, ♨️ Icono, 🦅 Top Global.",
      player.id,
      COLORS.yellow
    );
  }

  function showMoney(player) {
    const stats = getStats(player);
    announce(room, `Monedas: ${stats.coins}`, player.id, COLORS.yellow);
  }

  function handleIncognito(player, args) {
    const text = args.join(" ").trim();
    if (!text) {
      announce(room, "Usa: !inc <mensaje>", player.id, COLORS.red);
      return;
    }
    if (containsInsult(text)) {
      addXp(player, XP_VALUES.insult);
    }
    announce(room, `║ (Anónimo) : ${text}`, null, COLORS.red);
  }

  function handleSub(player, args) {
    if (args.length === 0 || args[0] === "me") {
      setTeam(room, player.id, 0);
      announce(room, "Sub aplicado a ti mismo.", player.id, COLORS.yellow);
      return;
    }
    if (!isVip(player)) {
      announce(room, "Solo VIP pueden usar !sub en otros.", player.id, COLORS.red);
      return;
    }
    const targetId = toNumber(args[0], -1);
    const target = room.getPlayer(targetId);
    if (!target) {
      announce(room, "ID inválido.", player.id, COLORS.red);
      return;
    }
    setTeam(room, target.id, 0);
    announce(room, `${target.name} fue enviado a specs.`, null, COLORS.yellow);
  }

  function handleKick(player, args) {
    if (!isAdmin(player) && !isOwnerAbsoluto(player)) {
      announce(room, "Sin permisos.", player.id, COLORS.red);
      return;
    }
    const targetId = toNumber(args[0], -1);
    const target = room.getPlayer(targetId);
    if (!target) {
      announce(room, "ID inválido.", player.id, COLORS.red);
      return;
    }
    if (isOwnerAbsoluto(target)) {
      announce(room, "No puedes expulsar al Owner absoluto.", player.id, COLORS.red);
      return;
    }
    room.kickPlayer(target.id, "Kicked by admin", false);
  }

  function handleBan(player, args) {
    if (!isAdmin(player) && !isOwnerAbsoluto(player)) {
      announce(room, "Sin permisos.", player.id, COLORS.red);
      return;
    }
    const targetId = toNumber(args[0], -1);
    const target = room.getPlayer(targetId);
    if (!target) {
      announce(room, "ID inválido.", player.id, COLORS.red);
      return;
    }
    if (isOwnerAbsoluto(target)) {
      announce(room, "No puedes banear al Owner absoluto.", player.id, COLORS.red);
      return;
    }
    room.kickPlayer(target.id, "Banned by admin", true);
  }

  function handleSwap(player, args) {
    if (!isAdmin(player) && !isOwnerAbsoluto(player)) {
      announce(room, "Sin permisos.", player.id, COLORS.red);
      return;
    }
    const targetId = toNumber(args[0], -1);
    const target = room.getPlayer(targetId);
    if (!target) {
      announce(room, "ID inválido.", player.id, COLORS.red);
      return;
    }
    const team = target.team === 1 ? 2 : 1;
    setTeam(room, target.id, team);
  }

  function handleSetRank(player, args) {
    if (!isAdmin(player) && !isOwnerAbsoluto(player)) {
      announce(room, "Sin permisos.", player.id, COLORS.red);
      return;
    }
    const targetId = toNumber(args[0], -1);
    const target = room.getPlayer(targetId);
    if (!target) {
      announce(room, "ID inválido.", player.id, COLORS.red);
      return;
    }
    const rankInput = args.slice(1).join(" ").trim();
    if (!rankInput) {
      announce(room, "Usa: !setrango <player> <rango|xp>", player.id, COLORS.red);
      return;
    }
    const stats = getStats(target);
    const numeric = Number(rankInput);
    if (Number.isFinite(numeric)) {
      stats.xp = numeric;
      announce(room, `${target.name} ahora tiene ${numeric} XP.`, null, COLORS.yellow);
      return;
    }
    const found = RANKS.find((rank) => rank.label.toLowerCase().includes(rankInput.toLowerCase()));
    if (!found) {
      announce(room, "Rango inválido.", player.id, COLORS.red);
      return;
    }
    stats.xp = found.minXp;
    announce(room, `${target.name} ahora es ${found.label}.`, null, COLORS.yellow);
  }

  function handleMaintenance(player, args) {
    if (!isAdmin(player) && !isOwnerAbsoluto(player)) {
      announce(room, "Sin permisos.", player.id, COLORS.red);
      return;
    }
    const pass = args.join(" ");
    if (!pass) {
      announce(room, "Falta contraseña.", player.id, COLORS.red);
      return;
    }
    if (pass !== MAINTENANCE_PASSWORD) {
      announce(room, "Contraseña incorrecta.", player.id, COLORS.red);
      return;
    }
    announce(room, "Modo mantenimiento activado.", null, COLORS.yellow);
    room.getPlayerList().forEach((p) => {
      if (!isAdmin(p) && !isOwnerAbsoluto(p)) room.kickPlayer(p.id, "Mantenimiento", false);
    });
  }

  function handle8ball(room, player, args) {
    if (!args.length) {
      announce(room, "Haz una pregunta.", player.id, COLORS.red);
      return;
    }
    const answers = ["Sí.", "No.", "Tal vez.", "Probablemente.", "No lo creo.", "Definitivamente."];
    const pick = answers[Math.floor(Math.random() * answers.length)];
    announce(room, `🎱 ${pick}`, null, COLORS.yellow);
  }

  room.onRoomLink = function (link) {
    log("room-link", link);
  };

  room.onPlayerJoin = function (player) {
    if (player.id === 0) return;
    handleJoinFlood();
    updateActivity(player);
    lastTeam.set(player.id, player.team);
    sendWelcome(player);
    grantVipBonusIfNeeded(player, room);
  };

  room.onPlayerLeave = function (player) {
    activityMap.delete(player.id);
    lastTeam.delete(player.id);
    if (pickState.active && (player.id === pickState.captains.red || player.id === pickState.captains.blue)) {
      refreshCaptains(room);
      pickState.currentCaptainId = pickState.captains[pickState.nextPickFrom];
      if (pickState.currentCaptainId) sendPickList(room);
    }
  };

  room.onPlayerChat = function (player, message) {
    if (player.id === 0) return false;

    if (handleCaptainPick(room, player, message)) return false;

    updateActivity(player);

    if (!checkSpam(player)) {
      announce(room, "Anti-spam activado. Espera un momento.", player.id, COLORS.red, "bold");
      return false;
    }

    if (containsInsult(message)) {
      addXp(player, XP_VALUES.insult);
      announce(room, `${player.name} ${XP_VALUES.insult} XP por insulto.`, player.id, COLORS.red);
    }

    if (!message.startsWith("!")) {
      const stats = getStats(player);
      const rank = getRank(stats.xp);
      const role = getRoleLabel(player);
      const prefix = role ? `${role} | ` : "";
      const vipTag = isVip(player) ? " 💎VIP" : "";
      announce(room, `║ ${prefix}${rank} | ${player.name}${vipTag} : ${message}`, null, COLORS.red);
      return false;
    }

    const [cmd, ...args] = message.trim().split(/\s+/);
    const command = cmd.toLowerCase();

    if (!checkCooldown(player.id, command, 2)) {
      announce(room, "Cooldown activo, espera.", player.id, COLORS.red);
      return false;
    }

    switch (command) {
      case "!help":
        showHelp(player);
        break;
      case "!bb":
        room.kickPlayer(player.id, "bye", false);
        break;
      case "!banana":
        announce(room, "🍌", null, COLORS.yellow);
        break;
      case "!calladmin": {
        const staff = room.getPlayerList().filter((p) => p.id !== 0 && isAdmin(p));
        if (!staff.length) {
          announce(room, "No hay admins conectados.", player.id, COLORS.red);
          break;
        }
        staff.forEach((admin) => {
          announce(room, `🔔 ${player.name} solicita un admin.`, admin.id, COLORS.yellow, "bold", 2);
        });
        announce(room, "Admins notificados.", player.id, COLORS.yellow);
        break;
      }
      case "!dc":
        announce(room, "Desconectando...", player.id, COLORS.yellow);
        room.kickPlayer(player.id, "dc", false);
        break;
      case "!mostrarstats":
        showStats(player);
        break;
      case "!sub":
        handleSub(player, args);
        break;
      case "!money":
        showMoney(player);
        break;
      case "!rangos":
        showRanks(player);
        break;
      case "!inc":
        handleIncognito(player, args);
        break;
      case "!votekick":
        handleVoteKick(room, player, toNumber(args[0], -1));
        break;
      case "!8ball":
        handle8ball(room, player, args);
        break;
      case "!afk":
        setTeam(room, player.id, 0);
        announce(room, `${player.name} está AFK.`, null, COLORS.yellow);
        break;
      case "!kick":
        handleKick(player, args);
        break;
      case "!ban":
        handleBan(player, args);
        break;
      case "!rr":
        if (!isAdmin(player) && !isOwnerAbsoluto(player)) {
          announce(room, "Sin permisos.", player.id, COLORS.red);
          break;
        }
        room.stopGame();
        room.startGame();
        announce(room, "Partido reiniciado.", null, COLORS.yellow, "bold");
        break;
      case "!swap":
        handleSwap(player, args);
        break;
      case "!setrango":
        handleSetRank(player, args);
        break;
      case "!mantenimiento":
        handleMaintenance(player, args);
        break;
      case "!apuesta":
      case "!size":
      case "!saltarcola":
        if (!isVip(player) && !isOwnerAbsoluto(player)) {
          announce(room, "Solo VIP.", player.id, COLORS.red);
          break;
        }
        announce(room, "Comando VIP recibido.", player.id, COLORS.yellow);
        break;
      case "!pick":
        if (!isOwnerAbsoluto(player)) {
          announce(room, "Sin permisos.", player.id, COLORS.red);
          break;
        }
        handleCaptainPick(room, player, args[0] || "", true);
        break;
      default:
        announce(room, "Comando desconocido.", player.id, COLORS.red);
        break;
    }

    return false;
  };

  room.onPlayerBallKick = function (player) {
    recordTouch(player);
    updateActivity(player);
  };

  room.onPlayerTeamChange = function (player) {
    handleTeamChange(room, player);
    updateActivity(player);
  };

  room.onPlayerActivity = function (player) {
    updateActivity(player);
  };

  room.onTeamGoal = function (team) {
    const scorerTouch = teamTouches[team].last;
    const assistTouch = teamTouches[team].prev;

    if (scorerTouch) {
      const scorer = room.getPlayer(scorerTouch.id);
      if (scorer) {
        const stats = getStats(scorer);
        stats.goals += 1;
        addXp(scorer, XP_VALUES.goal);
        announce(room, `${getRank(stats.xp)} | ${scorer.name} +${XP_VALUES.goal} XP (gol)`, null, COLORS.yellow);
      }
    }

    if (assistTouch && assistTouch.id !== scorerTouch?.id) {
      const scores = room.getScores();
      const time = scores ? scores.time : 0;
      if (!scorerTouch || time - assistTouch.time <= 10) {
        const assister = room.getPlayer(assistTouch.id);
        if (assister) {
          const stats = getStats(assister);
          stats.assists += 1;
          addXp(assister, XP_VALUES.assist);
          announce(room, `${getRank(stats.xp)} | ${assister.name} +${XP_VALUES.assist} XP (asistencia)`, null, COLORS.yellow);
        }
      }
    }

    if (scorerTouch) {
      const scorer = room.getPlayer(scorerTouch.id);
      if (scorer && scorer.team !== team) {
        addXp(scorer, XP_VALUES.ownGoal);
        announce(room, `${scorer.name} ${XP_VALUES.ownGoal} XP (autogol)`, null, COLORS.red);
      }
    }
  };

  room.onTeamVictory = function (scores) {
    const winningTeam = scores.red > scores.blue ? 1 : 2;
    const losingScore = winningTeam === 1 ? scores.blue : scores.red;
    const players = room.getPlayerList().filter((p) => p.team !== 0);

    players.forEach((player) => {
      addCoins(player, COIN_VALUES.play);
      if (player.team === winningTeam) {
        const stats = getStats(player);
        stats.wins += 1;
        addXp(player, XP_VALUES.win);
        addCoins(player, COIN_VALUES.win);
        grantVipBonusIfNeeded(player, room);
        announce(room, `${player.name} +${XP_VALUES.win} XP (win)`, null, COLORS.yellow);
        if (losingScore === 0) {
          stats.cleanSheets += 1;
          addXp(player, XP_VALUES.cleanSheet);
          addCoins(player, COIN_VALUES.cleanSheet);
          announce(room, `${player.name} +${XP_VALUES.cleanSheet} XP (cs)`, null, COLORS.yellow);
        }
      }
    });

    rotateTeamsAfterGame(winningTeam);
  };

  room.onGameStart = function () {
    resetTouches();
    announce(room, "¡A jugar!", null, COLORS.yellow, "bold");
    if (!pickState.active) {
      startPick(room, 2);
    }
  };

  setInterval(() => {
    const now = Date.now();
    room.getPlayerList().forEach((player) => {
      if (player.id === 0) return;
      const last = activityMap.get(player.id) || now;
      if (player.team !== 0 && now - last > AFK_LIMIT_SECONDS * 1000) {
        setTeam(room, player.id, 0);
        announce(room, `${player.name} fue enviado a specs por AFK.`, null, COLORS.yellow);
      }
    });
  }, 15000);
}
