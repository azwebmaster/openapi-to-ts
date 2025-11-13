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
    
    // Truncate itemName if it's too long to prevent line wrapping
    // Assume terminal width of 120 chars, leave room for progress info (~50 chars)
    const maxItemNameLength = 70;
    let itemDisplay = '';
    if (itemName) {
      const truncated = itemName.length > maxItemNameLength 
        ? itemName.substring(0, maxItemNameLength - 3) + '...'
        : itemName;
      itemDisplay = ` - ${truncated}`;
    }
    
    // Clear the line first, then write new content (prevents trailing characters)
    // Use \r to return to start of line, \x1b[K to clear from cursor to end of line
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
    // First clear the current line, then move to a new line, then print the message
    process.stdout.write(`\r\x1b[K\n${text}\n`);
  }
}

