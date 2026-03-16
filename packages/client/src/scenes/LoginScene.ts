import Phaser from 'phaser';
import {
  ClientMessageType,
  ServerMessageType,
  MIN_USERNAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  type LoginSuccessMessage,
  type LoginFailedMessage,
  type RegisterFailedMessage,
} from '@2wowd/shared';
import { NetworkManager } from '../network/NetworkManager';

export class LoginScene extends Phaser.Scene {
  private net!: NetworkManager;
  private formElement!: Phaser.GameObjects.DOMElement;

  constructor() {
    super({ key: 'LoginScene' });
  }

  create(): void {
    this.net = NetworkManager.instance;

    // Connect if not already connected
    this.net.connect();

    this.buildForm();
    this.registerNetworkHandlers();
  }

  private buildForm(): void {
    const formHtml = `
      <div style="background: rgba(20,20,40,0.95); padding: 40px; border-radius: 12px; border: 1px solid #444466; width: 320px; font-family: monospace;">
        <div style="text-align:center; margin-bottom:20px;">
          <div style="font-size:36px; color:#ffcc44; font-weight:bold;">2wowD</div>
          <div style="font-size:12px; color:#8888aa;">Enter the World</div>
        </div>
        <div style="margin-bottom:12px;">
          <label style="color:#aaaacc; font-size:12px;">Username</label>
          <input id="login-username" type="text" style="width:100%; padding:8px; margin-top:4px; background:#1a1a2e; border:1px solid #444466; color:#fff; font-family:monospace; border-radius:4px; box-sizing:border-box;" />
        </div>
        <div style="margin-bottom:16px;">
          <label style="color:#aaaacc; font-size:12px;">Password</label>
          <input id="login-password" type="password" style="width:100%; padding:8px; margin-top:4px; background:#1a1a2e; border:1px solid #444466; color:#fff; font-family:monospace; border-radius:4px; box-sizing:border-box;" />
        </div>
        <div style="display:flex; gap:8px;">
          <button id="login-btn" style="flex:1; padding:10px; background:#3344aa; color:#fff; border:none; border-radius:4px; cursor:pointer; font-family:monospace; font-weight:bold;">Login</button>
          <button id="register-btn" style="flex:1; padding:10px; background:#333344; color:#aaa; border:1px solid #444466; border-radius:4px; cursor:pointer; font-family:monospace;">Register</button>
        </div>
        <div id="login-error" style="color:#ff4444; font-size:11px; margin-top:10px; text-align:center; display:none;"></div>
        <div id="login-success" style="color:#44ff44; font-size:11px; margin-top:10px; text-align:center; display:none;"></div>
      </div>
    `;

    this.formElement = this.add.dom(640, 360).createFromHTML(formHtml);

    const loginBtn = this.formElement.getChildByID('login-btn') as HTMLButtonElement;
    const registerBtn = this.formElement.getChildByID('register-btn') as HTMLButtonElement;

    loginBtn.addEventListener('click', () => this.handleLogin());
    registerBtn.addEventListener('click', () => this.handleRegister());

    // Allow Enter key to submit login
    const passwordInput = this.formElement.getChildByID('login-password') as HTMLInputElement;
    passwordInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') this.handleLogin();
    });

    const usernameInput = this.formElement.getChildByID('login-username') as HTMLInputElement;
    usernameInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') this.handleLogin();
    });
  }

  private getInputValues(): { username: string; password: string } {
    const username = (this.formElement.getChildByID('login-username') as HTMLInputElement).value.trim();
    const password = (this.formElement.getChildByID('login-password') as HTMLInputElement).value;
    return { username, password };
  }

  private showError(message: string): void {
    const errorEl = this.formElement.getChildByID('login-error') as HTMLDivElement;
    const successEl = this.formElement.getChildByID('login-success') as HTMLDivElement;
    successEl.style.display = 'none';
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  private showSuccess(message: string): void {
    const errorEl = this.formElement.getChildByID('login-error') as HTMLDivElement;
    const successEl = this.formElement.getChildByID('login-success') as HTMLDivElement;
    errorEl.style.display = 'none';
    successEl.textContent = message;
    successEl.style.display = 'block';
  }

  private hideMessages(): void {
    const errorEl = this.formElement.getChildByID('login-error') as HTMLDivElement;
    const successEl = this.formElement.getChildByID('login-success') as HTMLDivElement;
    errorEl.style.display = 'none';
    successEl.style.display = 'none';
  }

  private validate(): { username: string; password: string } | null {
    const { username, password } = this.getInputValues();

    if (username.length < MIN_USERNAME_LENGTH) {
      this.showError(`Username must be at least ${MIN_USERNAME_LENGTH} characters.`);
      return null;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      this.showError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return null;
    }
    return { username, password };
  }

  private handleLogin(): void {
    this.hideMessages();
    const vals = this.validate();
    if (!vals) return;

    if (!this.net.isConnected) {
      this.showError('Not connected to server. Retrying...');
      this.net.connect();
      return;
    }

    this.net.send({
      type: ClientMessageType.Login,
      username: vals.username,
      password: vals.password,
    });
  }

  private handleRegister(): void {
    this.hideMessages();
    const vals = this.validate();
    if (!vals) return;

    if (!this.net.isConnected) {
      this.showError('Not connected to server. Retrying...');
      this.net.connect();
      return;
    }

    this.net.send({
      type: ClientMessageType.Register,
      username: vals.username,
      password: vals.password,
    });
  }

  private registerNetworkHandlers(): void {
    const onLoginSuccess = (msg: LoginSuccessMessage) => {
      this.cleanupListeners();
      this.scene.start('CharacterSelectScene', {
        accountId: msg.accountId,
        characters: msg.characters,
      });
    };

    const onLoginFailed = (msg: LoginFailedMessage) => {
      this.showError(msg.reason);
    };

    const onRegisterSuccess = () => {
      this.showSuccess('Account created! Please log in.');
    };

    const onRegisterFailed = (msg: RegisterFailedMessage) => {
      this.showError(msg.reason);
    };

    this.net.on(ServerMessageType.LoginSuccess, onLoginSuccess);
    this.net.on(ServerMessageType.LoginFailed, onLoginFailed);
    this.net.on(ServerMessageType.RegisterSuccess, onRegisterSuccess);
    this.net.on(ServerMessageType.RegisterFailed, onRegisterFailed);

    // Store refs for cleanup
    this._listeners = [
      { event: ServerMessageType.LoginSuccess, cb: onLoginSuccess },
      { event: ServerMessageType.LoginFailed, cb: onLoginFailed },
      { event: ServerMessageType.RegisterSuccess, cb: onRegisterSuccess },
      { event: ServerMessageType.RegisterFailed, cb: onRegisterFailed },
    ];
  }

  private _listeners: Array<{ event: string; cb: (data: unknown) => void }> = [];

  private cleanupListeners(): void {
    for (const { event, cb } of this._listeners) {
      this.net.off(event, cb);
    }
    this._listeners = [];
  }

  shutdown(): void {
    this.cleanupListeners();
  }
}
