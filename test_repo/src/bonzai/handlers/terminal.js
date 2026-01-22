let pty;
try {
  pty = require('node-pty');
} catch (err) {
  pty = null;
}

// Store active terminal sessions
const terminals = new Map();

// Get default shell based on platform
function getDefaultShell() {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe';
  }
  const shell = process.env.SHELL || '/bin/bash';
  if (!shell.startsWith('/')) {
    return '/bin/bash';
  }
  return shell;
}

// Create a new terminal session
function createTerminal(sessionId, cols = 80, rows = 24) {
  if (!pty) {
    throw new Error('node-pty is not available. Native binaries may not have installed correctly.');
  }

  const shell = getDefaultShell();
  const cwd = process.env.BONZAI_REPO_DIR || process.cwd();

  let ptyProcess;
  try {
    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'
      }
    });
  } catch (spawnErr) {
    try {
      ptyProcess = pty.spawn('/bin/bash', [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'
        }
      });
    } catch (bashErr) {
      throw spawnErr;
    }
  }

  terminals.set(sessionId, {
    pty: ptyProcess,
    buffer: ''
  });

  return ptyProcess;
}

// HTTP handler for terminal info
function terminalHandler(req, res) {
  res.json({
    message: 'Terminal WebSocket API',
    usage: {
      websocket: 'ws://localhost:3001/terminal',
      events: {
        'input': 'Send terminal input (data: string)',
        'resize': 'Resize terminal (cols: number, rows: number)',
        'output': 'Receive terminal output'
      }
    }
  });
}

// WebSocket handler for terminal sessions
function setupTerminalWebSocket(wss) {
  wss.on('connection', (ws) => {
    const sessionId = Date.now().toString();
    let ptyProcess;

    try {
      ptyProcess = createTerminal(sessionId);
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to create terminal: ' + err.message }));
      ws.close();
      return;
    }

    // Send terminal output to WebSocket client
    ptyProcess.onData((data) => {
      try {
        ws.send(JSON.stringify({ type: 'output', data }));
      } catch (e) {
        // Client disconnected
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      ws.send(JSON.stringify({ type: 'exit', exitCode }));
      ws.close();
    });

    // Handle incoming messages from client
    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message);

        switch (msg.type) {
          case 'input':
            ptyProcess.write(msg.data);
            break;
          case 'resize':
            ptyProcess.resize(msg.cols, msg.rows);
            break;
        }
      } catch (e) {
        // Parse error
      }
    });

    // Cleanup on disconnect
    ws.on('close', () => {
      ptyProcess.kill();
      terminals.delete(sessionId);
    });
  });
}

module.exports = { terminalHandler, setupTerminalWebSocket };
