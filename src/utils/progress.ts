/**
 * Simple progress indicator utility for terminal output
 */
export class ProgressIndicator {
  private currentStep = 0;
  private totalSteps = 0;
  private stepName = '';
  private startTime = Date.now();
  private disabled: boolean;

  constructor(disabled: boolean = false) {
    this.disabled = disabled;
  }

  start(totalSteps: number, stepName: string): void {
    if (this.disabled) return;
    this.totalSteps = totalSteps;
    this.currentStep = 0;
    this.stepName = stepName;
    this.startTime = Date.now();
    this.update(0);
  }

  update(current: number, itemName?: string): void {
    if (this.disabled) return;
    this.currentStep = current;
    const percentage = this.totalSteps > 0 
      ? Math.round((this.currentStep / this.totalSteps) * 100)
      : 0;
    const elapsed = Date.now() - this.startTime;
    const elapsedSeconds = (elapsed / 1000).toFixed(1);
    
    const itemDisplay = itemName ? ` - ${itemName}` : '';
    // Clear the line first, then write new content (prevents trailing characters)
    // Use \x1b[K to clear from cursor to end of line, ensuring old characters are removed
    process.stdout.write(`\r\x1b[K${this.stepName}: [${this.currentStep}/${this.totalSteps}] ${percentage}%${itemDisplay}`);
  }

  increment(itemName?: string): void {
    if (this.disabled) return;
    this.update(this.currentStep + 1, itemName);
  }

  complete(): void {
    if (this.disabled) return;
    const elapsed = Date.now() - this.startTime;
    const elapsedSeconds = (elapsed / 1000).toFixed(1);
    // Clear the line first to remove any trailing characters, then write completion message
    process.stdout.write(`\r\x1b[K${this.stepName}: [${this.totalSteps}/${this.totalSteps}] 100% ✓ (${elapsedSeconds}s)\n`);
  }

  message(text: string): void {
    if (this.disabled) return;
    // Clear any progress line that might be active before printing a new message
    process.stdout.write(`\r\x1b[K\n${text}\n`);
  }
}

