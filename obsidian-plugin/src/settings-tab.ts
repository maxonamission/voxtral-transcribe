// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe
import { App, Platform, PluginSettingTab, Setting } from "obsidian";
import type VoxtralPlugin from "./main";
import { AudioRecorder } from "./audio-recorder";
import { listModels } from "./mistral-api";
import type { MistralModel, } from "./mistral-api";
import type { FocusBehavior, CustomCommand } from "./types";
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES } from "./lang";

export class VoxtralSettingTab extends PluginSettingTab {
	plugin: VoxtralPlugin;
	private cachedModels: MistralModel[] | null = null;

	constructor(app: App, plugin: VoxtralPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		;

		new Setting(containerEl)
			.setName("Mistral API key")
			.setDesc("Your API key from platform.mistral.ai")
			.addText((text) =>
				text
					.setPlaceholder("Enter your API key")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value.trim();
						await this.plugin.saveSettings();
					})
			)
			.then((setting) => {
				const input = setting.controlEl.querySelector("input");
				if (input) input.type = "password";
			});

		// Microphone selection
		const micSetting = new Setting(containerEl)
			.setName("Microphone")
			.setDesc("Select which microphone to use");

		micSetting.addDropdown((drop) => {
			drop.addOption("", "System default");
			drop.setValue(this.plugin.settings.microphoneDeviceId);

			// Populate async
			AudioRecorder.enumerateMicrophones().then((mics) => {
				for (const mic of mics) {
					drop.addOption(mic.deviceId, mic.label);
				}
				drop.setValue(this.plugin.settings.microphoneDeviceId);
			}).catch((err) => {
				console.error("Voxtral: Failed to enumerate microphones", err);
			});

			drop.onChange(async (value) => {
				this.plugin.settings.microphoneDeviceId = value;
				await this.plugin.saveSettings();
			});
		});

		const modeDesc = Platform.isMobile
			? "Only batch mode is available on mobile. Use tap-to-send to submit chunks while you keep talking."
			: "Realtime: text appears as you speak. Batch: audio is transcribed after you stop recording.";

		const modeSetting = new Setting(containerEl)
			.setName("Mode")
			.setDesc(modeDesc);

		if (Platform.isMobile) {
			modeSetting.addDropdown((drop) =>
				drop
					.addOption("batch", "Batch (after recording)")
					.setValue("batch")
					.setDisabled(true)
			);
		} else {
			modeSetting.addDropdown((drop) =>
				drop
					.addOption("realtime", "Realtime (streaming)")
					.addOption("batch", "Batch (after recording)")
					.setValue(this.plugin.settings.mode)
					.onChange(async (value) => {
						this.plugin.settings.mode = value as
							| "realtime"
							| "batch";
						await this.plugin.saveSettings();
					})
			);
		}

		// Enter-to-send (batch mode)
		new Setting(containerEl)
			.setName("Enter = tap-to-send")
			.setDesc(
				"In batch mode, pressing Enter sends the current audio chunk when the mic is live. " +
				"While typing, Enter inserts a normal newline."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enterToSend)
					.onChange(async (value) => {
						this.plugin.settings.enterToSend = value;
						await this.plugin.saveSettings();
					})
			);

		// Typing cooldown
		new Setting(containerEl)
			.setName("Typing cooldown")
			.setDesc(
				"How long after you stop typing before the mic unmutes again"
			)
			.addDropdown((drop) => {
				const options: Record<string, string> = {
					"400": "400 ms (fast)",
					"800": "800 ms (default)",
					"1200": "1.2 sec",
					"1500": "1.5 sec",
					"2000": "2 sec",
					"3000": "3 sec",
				};
				for (const [value, label] of Object.entries(options)) {
					drop.addOption(value, label);
				}
				drop.setValue(
					String(this.plugin.settings.typingCooldownMs)
				).onChange(async (value) => {
					this.plugin.settings.typingCooldownMs = Number(value);
					await this.plugin.saveSettings();
				});
			});

		// Focus behavior
		new Setting(containerEl)
			.setName("On focus loss")
			.setDesc(
				"What should happen when you switch apps while recording?"
			)
			.addDropdown((drop) => {
				drop.addOption("pause", "Pause immediately");
				drop.addOption(
					"pause-after-delay",
					"Pause after delay"
				);
				drop.addOption("keep-recording", "Keep recording");
				drop.setValue(this.plugin.settings.focusBehavior).onChange(
					async (value) => {
						this.plugin.settings.focusBehavior =
							value as FocusBehavior;
						await this.plugin.saveSettings();
						// Re-render to show/hide delay setting
						this.display();
					}
				);
			});

		if (this.plugin.settings.focusBehavior === "pause-after-delay") {
			new Setting(containerEl)
				.setName("Pause delay (seconds)")
				.setDesc(
					"How long to wait in the background before pausing the recording"
				)
				.addDropdown((drop) => {
					const options: Record<string, string> = {
						"10": "10 sec",
						"30": "30 sec (default)",
						"60": "1 minute",
						"120": "2 minutes",
						"300": "5 minutes",
					};
					for (const [value, label] of Object.entries(options)) {
						drop.addOption(value, label);
					}
					drop.setValue(
						String(this.plugin.settings.focusPauseDelaySec)
					).onChange(async (value) => {
						this.plugin.settings.focusPauseDelaySec =
							Number(value);
						await this.plugin.saveSettings();
					});
				});
		}

		new Setting(containerEl)
			.setName("Language")
			.setDesc("Language for transcription and voice commands")
			.addDropdown((dropdown) => {
				for (const code of SUPPORTED_LANGUAGES) {
					dropdown.addOption(code, `${LANGUAGE_NAMES[code]} (${code})`);
				}
				dropdown.setValue(this.plugin.settings.language);
				dropdown.onChange(async (value) => {
					this.plugin.settings.language = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Auto-correct")
			.setDesc(
				"Automatically correct spelling, capitalization, and punctuation after recording"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoCorrect)
					.onChange(async (value) => {
						this.plugin.settings.autoCorrect = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Noise suppression")
			.setDesc(
				"Enable browser-level noise suppression, echo cancellation, and auto gain control. " +
				"Useful in noisy environments."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.noiseSuppression)
					.onChange(async (value) => {
						this.plugin.settings.noiseSuppression = value;
						await this.plugin.saveSettings();
					})
			);

		const dualDelaySetting = new Setting(containerEl)
			.setName("Dual-delay mode")
			.setDesc(
				Platform.isMobile
					? "Not available on mobile (requires realtime streaming)."
					: "Run two parallel streams: a fast one for immediate text and a slow one " +
					  "for higher accuracy and voice command detection. Overrides the streaming delay setting."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.dualDelay)
					.setDisabled(Platform.isMobile)
					.onChange(async (value) => {
						this.plugin.settings.dualDelay = value;
						await this.plugin.saveSettings();
						this.display(); // re-render to show/hide delay settings
					});
			});

		if (!Platform.isMobile && !this.plugin.settings.dualDelay) {
			new Setting(containerEl)
				.setName("Streaming delay")
				.setDesc(
					"Delay in ms for realtime mode. Lower = faster but less accurate."
				)
				.addDropdown((drop) => {
					const options: Record<string, string> = {
						"240": "240 ms (fastest)",
						"480": "480 ms (default)",
						"640": "640 ms",
						"800": "800 ms",
						"1200": "1200 ms",
						"1600": "1600 ms",
						"2400": "2400 ms (most accurate)",
					};
					for (const [value, label] of Object.entries(options)) {
						drop.addOption(value, label);
					}
					drop.setValue(
						String(this.plugin.settings.streamingDelayMs)
					).onChange(async (value) => {
						this.plugin.settings.streamingDelayMs = Number(value);
						await this.plugin.saveSettings();
					});
				});
		}

		// Hotkeys hint
		new Setting(containerEl).setName("Keyboard shortcuts").setHeading();

		new Setting(containerEl)
			.setName("Customize hotkeys")
			.setDesc(
				"You can assign keyboard shortcuts to all Voxtral commands " +
				"(start/stop recording, correct selection, correct note, etc.) " +
				"via Obsidian's Settings → Hotkeys. Search for \"Voxtral\"."
			)
			.addButton((btn) =>
				btn
					.setButtonText("Open hotkeys")
					.onClick(() => {
						// Open Obsidian's hotkey settings and pre-filter
						// @ts-expect-error Accessing internal Obsidian API for hotkey tab navigation
						const appSetting = this.app.setting;
						appSetting?.openTabById?.("hotkeys");
						const tab = appSetting?.activeTab;
						if (tab?.searchComponent) {
							tab.searchComponent.setValue("Voxtral");
							tab.updateHotkeyVisibility?.();
						}
					})
			);

		// Support
		new Setting(containerEl).setName("Support this project").setHeading();

		new Setting(containerEl)
			.setName("Buy me a coffee")
			.setDesc("Find this plugin useful? Consider a donation!")
			.addButton((btn) =>
				btn
					.setButtonText("Buy me a coffee")
					.onClick(() => {
						window.open("https://buymeacoffee.com/maxonamission");
					})
			);

		// Custom voice commands
		new Setting(containerEl).setName("Custom voice commands").setHeading();
		this.renderCustomCommands(containerEl);

		// Advanced settings
		new Setting(containerEl).setName("Advanced").setHeading();

		// Filter helpers based on model capabilities
		const isTranscriptionModel = (m: MistralModel) =>
			!!m.capabilities?.audio_transcription;
		const isChatModel = (m: MistralModel) =>
			!!m.capabilities?.completion_chat;

		this.addModelDropdown(
			containerEl,
			"Realtime model",
			"Model for real-time streaming transcription",
			this.plugin.settings.realtimeModel,
			async (value) => {
				this.plugin.settings.realtimeModel = value.trim();
				await this.plugin.saveSettings();
			},
			isTranscriptionModel
		);

		this.addModelDropdown(
			containerEl,
			"Batch model",
			"Model for batch transcription",
			this.plugin.settings.batchModel,
			async (value) => {
				this.plugin.settings.batchModel = value.trim();
				await this.plugin.saveSettings();
			},
			isTranscriptionModel
		);

		this.addModelDropdown(
			containerEl,
			"Correction model",
			"Model for text correction",
			this.plugin.settings.correctModel,
			async (value) => {
				this.plugin.settings.correctModel = value.trim();
				await this.plugin.saveSettings();
			},
			isChatModel
		);

		new Setting(containerEl)
			.setName("Correction system prompt")
			.setDesc("Leave empty to use the default prompt")
			.addTextArea((text) =>
				text
					.setPlaceholder("Default correction prompt will be used...")
					.setValue(this.plugin.settings.systemPrompt)
					.onChange(async (value) => {
						this.plugin.settings.systemPrompt = value;
						await this.plugin.saveSettings();
					})
			)
			.then((setting) => {
				const textarea = setting.controlEl.querySelector("textarea");
				if (textarea) {
					textarea.rows = 6;
					textarea.classList.add("voxtral-textarea-full");
				}
			});
	}

	private renderCustomCommands(containerEl: HTMLElement): void {
		const commands = this.plugin.settings.customCommands;
		const lang = this.plugin.settings.language;

		// Existing commands
		for (let i = 0; i < commands.length; i++) {
			const cmd = commands[i];
			const triggers = cmd.triggers[lang] ?? cmd.triggers["en"] ?? [];
			const typeLabel = cmd.type === "slot"
				? `${cmd.slotPrefix ?? ""}…${cmd.slotSuffix ?? ""}`
				: (cmd.insertText ?? "").replace(/\n/g, "↵").slice(0, 30);

			new Setting(containerEl)
				.setName(triggers.join(", ") || cmd.id)
				.setDesc(`${cmd.type === "slot" ? "Slot" : "Insert"}: ${typeLabel}`)
				.addButton((btn) =>
					btn
						.setButtonText("Edit")
						.onClick(() => {
							this.openCommandEditor(cmd, i);
						})
				)
				.addButton((btn) =>
					btn
						.setButtonText("Delete")
						.setWarning()
						.onClick(async () => {
							commands.splice(i, 1);
							await this.plugin.saveSettings();
							this.display();
						})
				);
		}

		// Add new command button
		new Setting(containerEl)
			.setDesc("Add a custom voice command for inserting text or opening a slot")
			.addButton((btn) =>
				btn
					.setButtonText("+ Add command")
					.setCta()
					.onClick(() => {
						const newCmd: CustomCommand = {
							id: `custom-${Date.now()}`,
							triggers: { [lang]: [""] },
							type: "insert",
							insertText: "",
						};
						commands.push(newCmd);
						this.openCommandEditor(newCmd, commands.length - 1);
					})
			);
	}

	private openCommandEditor(cmd: CustomCommand, index: number): void {
		const modal = document.createElement("div");
		modal.addClass("modal-container", "mod-dim");
		const modalBg = modal.createDiv("modal-bg");
		modalBg.style.opacity = "0.85";
		const modalEl = modal.createDiv("modal");
		modalEl.style.maxWidth = "500px";
		modalEl.style.padding = "20px";

		const lang = this.plugin.settings.language;

		// Title
		const title = modalEl.createEl("h3", { text: "Custom voice command" });
		title.style.marginTop = "0";

		// Trigger phrases
		const triggerLabel = modalEl.createEl("label", { text: "Trigger phrases (comma-separated)" });
		triggerLabel.style.display = "block";
		triggerLabel.style.marginBottom = "4px";
		triggerLabel.style.fontWeight = "bold";
		const triggerInput = modalEl.createEl("input", { type: "text" });
		triggerInput.style.width = "100%";
		triggerInput.style.marginBottom = "12px";
		triggerInput.value = (cmd.triggers[lang] ?? []).join(", ");

		// Type selector
		const typeLabel = modalEl.createEl("label", { text: "Type" });
		typeLabel.style.display = "block";
		typeLabel.style.marginBottom = "4px";
		typeLabel.style.fontWeight = "bold";
		const typeSelect = modalEl.createEl("select");
		typeSelect.style.width = "100%";
		typeSelect.style.marginBottom = "12px";
		typeSelect.createEl("option", { text: "Insert text", value: "insert" });
		typeSelect.createEl("option", { text: "Slot (type between prefix/suffix)", value: "slot" });
		typeSelect.value = cmd.type;

		// Insert text field
		const insertContainer = modalEl.createDiv();
		const insertLabel = insertContainer.createEl("label", { text: "Text to insert" });
		insertLabel.style.display = "block";
		insertLabel.style.marginBottom = "4px";
		insertLabel.style.fontWeight = "bold";
		const insertDesc = insertContainer.createEl("small", { text: "Use \\n for newline" });
		insertDesc.style.display = "block";
		insertDesc.style.marginBottom = "4px";
		insertDesc.style.color = "var(--text-muted)";
		const insertInput = insertContainer.createEl("input", { type: "text" });
		insertInput.style.width = "100%";
		insertInput.style.marginBottom = "12px";
		insertInput.value = (cmd.insertText ?? "").replace(/\n/g, "\\n");

		// Slot fields
		const slotContainer = modalEl.createDiv();
		const prefixLabel = slotContainer.createEl("label", { text: "Prefix (e.g. [[ or **)" });
		prefixLabel.style.display = "block";
		prefixLabel.style.marginBottom = "4px";
		prefixLabel.style.fontWeight = "bold";
		const prefixInput = slotContainer.createEl("input", { type: "text" });
		prefixInput.style.width = "100%";
		prefixInput.style.marginBottom = "8px";
		prefixInput.value = cmd.slotPrefix ?? "";

		const suffixLabel = slotContainer.createEl("label", { text: "Suffix (e.g. ]] or **)" });
		suffixLabel.style.display = "block";
		suffixLabel.style.marginBottom = "4px";
		suffixLabel.style.fontWeight = "bold";
		const suffixInput = slotContainer.createEl("input", { type: "text" });
		suffixInput.style.width = "100%";
		suffixInput.style.marginBottom = "8px";
		suffixInput.value = cmd.slotSuffix ?? "";

		const exitLabel = slotContainer.createEl("label", { text: "Close slot on" });
		exitLabel.style.display = "block";
		exitLabel.style.marginBottom = "4px";
		exitLabel.style.fontWeight = "bold";
		const exitSelect = slotContainer.createEl("select");
		exitSelect.style.width = "100%";
		exitSelect.style.marginBottom = "12px";
		exitSelect.createEl("option", { text: "Enter", value: "enter" });
		exitSelect.createEl("option", { text: "Space", value: "space" });
		exitSelect.createEl("option", { text: "Enter or Space", value: "enter-or-space" });
		exitSelect.value = cmd.slotExit ?? "enter";

		// Show/hide based on type
		const updateVisibility = () => {
			insertContainer.style.display = typeSelect.value === "insert" ? "block" : "none";
			slotContainer.style.display = typeSelect.value === "slot" ? "block" : "none";
		};
		typeSelect.addEventListener("change", updateVisibility);
		updateVisibility();

		// Buttons
		const btnRow = modalEl.createDiv();
		btnRow.style.display = "flex";
		btnRow.style.justifyContent = "flex-end";
		btnRow.style.gap = "8px";
		btnRow.style.marginTop = "16px";

		const cancelBtn = btnRow.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => modal.remove());

		const saveBtn = btnRow.createEl("button", { text: "Save", cls: "mod-cta" });
		saveBtn.addEventListener("click", async () => {
			// Parse triggers
			const triggers = triggerInput.value
				.split(",")
				.map((t) => t.trim())
				.filter((t) => t.length > 0);
			if (triggers.length === 0) {
				triggerInput.style.borderColor = "var(--text-error)";
				return;
			}

			cmd.triggers[lang] = triggers;
			cmd.type = typeSelect.value as "insert" | "slot";

			if (cmd.type === "insert") {
				cmd.insertText = insertInput.value.replace(/\\n/g, "\n");
				cmd.slotPrefix = undefined;
				cmd.slotSuffix = undefined;
				cmd.slotExit = undefined;
			} else {
				cmd.slotPrefix = prefixInput.value;
				cmd.slotSuffix = suffixInput.value;
				cmd.slotExit = exitSelect.value as "enter" | "space" | "enter-or-space";
				cmd.insertText = undefined;
			}

			this.plugin.settings.customCommands[index] = cmd;
			await this.plugin.saveSettings();
			modal.remove();
			this.display();
		});

		// Close on bg click
		modalBg.addEventListener("click", () => modal.remove());

		document.body.appendChild(modal);
	}

	/**
	 * Add a model dropdown that fetches options from the Mistral API.
	 * Falls back to a text field if no API key is set or the fetch fails.
	 * The current value is always shown, even if not in the fetched list.
	 */
	private addModelDropdown(
		containerEl: HTMLElement,
		name: string,
		desc: string,
		currentValue: string,
		onChange: (value: string) => Promise<void>,
		filter?: (model: MistralModel) => boolean
	): void {
		const setting = new Setting(containerEl).setName(name).setDesc(desc);

		setting.addDropdown((drop) => {
			// Always include the current value so it's visible immediately
			if (currentValue) {
				drop.addOption(currentValue, currentValue);
			}
			drop.setValue(currentValue);

			drop.onChange(async (value) => {
				await onChange(value);
			});

			// Fetch models async and populate
			this.getModels().then((models) => {
				if (models.length === 0) return;

				// Apply capability filter if provided
				const filtered = filter ? models.filter(filter) : models;

				// Clear and repopulate
				const selectEl = drop.selectEl;
				selectEl.empty();

				// Add all models, marking current value if present
				const ids = filtered.map((m) => m.id);
				if (currentValue && !ids.includes(currentValue)) {
					drop.addOption(currentValue, `${currentValue} (current)`);
				}
				for (const model of filtered) {
					drop.addOption(model.id, model.id);
				}
				drop.setValue(currentValue);
			}).catch((err) => {
				console.error("Voxtral: Failed to fetch models", err);
			});
		});
	}

	private async getModels(): Promise<MistralModel[]> {
		if (this.cachedModels) return this.cachedModels;

		const models = await listModels(this.plugin.settings.apiKey);
		if (models.length > 0) {
			this.cachedModels = models;
		}
		return models;
	}
}
