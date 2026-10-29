'use strict';
// Exercise the actual installed Godot GUI with an isolated fixture session.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

async function main() {
  const [runtimeArg, outputArg, moduleArg, expected = 'visible'] = process.argv.slice(2);
  assert(runtimeArg && outputArg);
  assert(['visible', 'hidden'].includes(expected));
  const root = path.resolve(runtimeArg), output = path.resolve(outputArg);
  assert(!fs.existsSync(output), 'Keep previous evidence');
  fs.mkdirSync(output, { recursive: true });
  const previousAppData = process.env.APPDATA;
  process.env.APPDATA = path.join(output, 'profile');
  const { createNativeCardRunner } = require(moduleArg ? path.resolve(moduleArg) : '../desktop/native-card-runner');
  const probe = path.join(output, 'window-probe.ps1');
  fs.writeFileSync(probe, `param([int]$TaskParentId)
Add-Type @'
using System;using System.Text;using System.Collections.Generic;using System.Runtime.InteropServices;
public class CardVisibleProbe {
 public delegate bool Callback(IntPtr h,IntPtr p);
 [DllImport("user32.dll")]static extern bool EnumWindows(Callback cb,IntPtr p);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern int GetWindowText(IntPtr h,StringBuilder b,int n);
 public static string[] Find(uint pid){var rows=new List<string>();EnumWindows((h,p)=>{uint id;GetWindowThreadProcessId(h,out id);if(id==pid){var b=new StringBuilder(512);GetWindowText(h,b,512);if(b.ToString()=="PIRATE ODYSSEY - Card Arena")rows.Add(h.ToInt64()+"|"+IsWindowVisible(h));}return true;},IntPtr.Zero);return rows.ToArray();}
}
'@
$rows=@();Get-CimInstance Win32_Process -Filter "Name='pirate-card.exe' AND ParentProcessId=$TaskParentId" | ForEach-Object {
 $taskPid=$_.ProcessId;foreach($row in [CardVisibleProbe]::Find($taskPid)){$parts=$row.Split('|');$rows+=@{pid=$taskPid;handle=$parts[0];visible=$parts[1] -eq 'True'}}
}
ConvertTo-Json -InputObject $rows -Compress
`);
  const auth = {
    getSecretForGame: () => 'isolated-qa-secret',
    accountSummary: () => ({ userId: 7, name: 'Window visibility QA' }),
    getGameBootstrap: () => ({ op_device_id: 'isolated-window-qa' }),
    getPreferences: () => ({ gameDisplayMode: 'windowed' })
  };
  const runner = createNativeCardRunner({ root, auth, assets: {} });
  let rows = [], result;
  try {
    assert.equal((await runner.launch()).ok, true);
    for (let n = 0; n < 6; n++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      rows = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-File', probe, '-TaskParentId', String(process.pid)], { windowsHide: true, encoding: 'utf8', timeout: 15000 }));
      if (rows.length) break;
    }
    assert.equal(rows.length, 1, 'Exactly one real game window belonging to this runner');
    assert.equal(rows[0].visible, expected === 'visible');
    assert.equal(runner.isRunning(), true);
    assert.equal((await runner.launch()).alreadyRunning, true);
    result = { passed: true, expected, windows: rows, actualPlayerPack: true, fixtureAccount: true, playerProfileTouched: false, duplicateLaunchPrevented: true };
  } finally {
    runner.close();
    if (previousAppData === undefined) delete process.env.APPDATA; else process.env.APPDATA = previousAppData;
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result || { passed: false, expected, windows: rows }, null, 2));
  }
  console.log(JSON.stringify(result));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
