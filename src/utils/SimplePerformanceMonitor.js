import { performance } from 'perf_hooks';
import { cpus, totalmem, freemem } from 'os';

export class SimplePerformanceMonitor {
  constructor() {
    this.startTime = null;
    this.phases = [];
    this.currentPhase = null;

    // Simple metrics tracking
    this.metrics = {
      startMemory: null,
      peakMemory: 0,
      currentMemory: 0,
      totalCPUs: cpus().length,
      systemMemoryMB: Math.round(totalmem() / 1024 / 1024),
      // Browser-specific metrics
      browserStartMemory: 0,
      browserPeakMemory: 0,
      browserCurrentMemory: 0,
      totalSystemMemoryStart: 0,
      peakSystemMemoryUsed: 0,
    };

    this.monitoringInterval = null;
    this.browserMetricsAvailable = false;
  }

  /**
   * Start performance monitoring
   */
  start() {
    this.startTime = performance.now();
    this.metrics.startMemory = this._getMemoryMB();
    this.metrics.currentMemory = this.metrics.startMemory;
    this.metrics.peakMemory = this.metrics.startMemory;
    this.metrics.totalSystemMemoryStart = this._getSystemMemoryUsedMB();
    this.metrics.peakSystemMemoryUsed = this.metrics.totalSystemMemoryStart;

    // Monitor memory every 5 seconds
    this.monitoringInterval = setInterval(async () => {
      await this._updateMetrics();
    }, 5000);
  }

  /**
   * Start a phase
   */
  startPhase(phaseName) {
    // End previous phase if exists
    if (this.currentPhase) {
      this.endPhase();
    }

    this.currentPhase = {
      name: phaseName,
      startTime: performance.now(),
      startMemory: this._getMemoryMB(),
    };
  }

  /**
   * End current phase
   */
  endPhase() {
    if (!this.currentPhase) return;

    const endTime = performance.now();
    const endMemory = this._getMemoryMB();
    const duration = Math.round(endTime - this.currentPhase.startTime);
    const memoryChange = endMemory - this.currentPhase.startMemory;

    this.phases.push({
      name: this.currentPhase.name,
      duration,
      memoryChange: Math.round(memoryChange * 10) / 10,
    });

    this.currentPhase = null;
  }

  /**
   * Stop monitoring and show summary
   */
  stop() {
    // Prevent multiple stops
    if (!this.startTime || !this.monitoringInterval) {
      return;
    }

    // End any current phase
    if (this.currentPhase) {
      this.endPhase();
    }

    clearInterval(this.monitoringInterval);
    this.monitoringInterval = null;

    const totalDuration = performance.now() - this.startTime;
    const finalMemory = this._getMemoryMB();
    const memoryGrowth = finalMemory - this.metrics.startMemory;

    // Always show Performance Summary at the end
    console.log('\n📊 Performance Summary:');
    console.log(`   ⏱️  Total Time: ${this._formatDuration(totalDuration)}`);
    console.log(
      `   🧠 Node.js Memory: ${this.metrics.startMemory}MB → ${finalMemory}MB (${memoryGrowth > 0 ? '+' : ''}${memoryGrowth.toFixed(1)}MB)`
    );

    if (this.browserMetricsAvailable && this.metrics.browserPeakMemory > 0) {
      const browserGrowth =
        this.metrics.browserCurrentMemory - this.metrics.browserStartMemory;
      console.log(
        `   🌐 Browser Memory: ${this.metrics.browserStartMemory}MB → ${this.metrics.browserCurrentMemory}MB (${browserGrowth > 0 ? '+' : ''}${browserGrowth.toFixed(1)}MB)`
      );
      const totalPeak =
        this.metrics.peakMemory + this.metrics.browserPeakMemory;
      console.log(`   🔥 Combined Peak: ${totalPeak}MB (Node.js + Browser)`);
    }

    if (this.phases.length > 0) {
      console.log('\n📋 Phase Breakdown:');
      this.phases.forEach(phase => {
        const percentage = Math.round((phase.duration / totalDuration) * 100);
        console.log(
          `   • ${phase.name}: ${this._formatDuration(
            phase.duration
          )} (${percentage}%)`
        );
      });
    }

    // Performance assessment for significant issues
    if (totalDuration > 60000 || Math.abs(memoryGrowth) > 100) {
      this._showPerformanceAssessment(totalDuration, memoryGrowth);
    }
  }

  /**
   * Log current status (called during monitoring) - simplified
   */
  logCurrentStatus() {
    // Only show status during very long-running phases
    if (!this.currentPhase) return;

    const elapsed = Math.round(
      (performance.now() - this.currentPhase.startTime) / 1000
    );
    // Only show status if phase is running for more than 30 seconds
    if (elapsed > 30 && elapsed % 15 === 0) {
      const phaseName = this.currentPhase.name;
      console.log(`   ⏱️  ${phaseName}: ${elapsed}s elapsed...`);
    }
  }

  /**
   * Get current memory usage in MB
   */
  _getMemoryMB() {
    const memUsage = process.memoryUsage();
    return Math.round((memUsage.heapUsed / 1024 / 1024) * 10) / 10;
  }

  /**
   * Get total system memory used in MB
   */
  _getSystemMemoryUsedMB() {
    const totalMem = totalmem();
    const freeMem = freemem();
    const usedMem = totalMem - freeMem;
    return Math.round(usedMem / 1024 / 1024);
  }

  /**
   * Get browser memory usage via CDP if available
   */
  async _getBrowserMemoryMB(page) {
    try {
      if (!page || !page.context) {
        return 0;
      }

      // Try CDP approach first (most accurate)
      try {
        const client = await page.context().newCDPSession(page);
        const result = await client.send('Runtime.getHeapUsage');
        await client.detach();

        // Handle different possible response structures
        let usedSize = 0;
        if (result && result.result && result.result.usedSize) {
          usedSize = result.result.usedSize;
        } else if (result && result.usedSize) {
          usedSize = result.usedSize;
        } else if (result && typeof result === 'object') {
          // Try to find usedSize in any nested structure
          const findUsedSize = obj => {
            if (obj && typeof obj === 'object') {
              if (obj.usedSize) return obj.usedSize;
              for (const key in obj) {
                const found = findUsedSize(obj[key]);
                if (found) return found;
              }
            }
            return null;
          };
          usedSize = findUsedSize(result) || 0;
        }

        return Math.round((usedSize / 1024 / 1024) * 10) / 10;
      } catch {
        // Fallback to system memory estimation
        const currentSystemMem = this._getSystemMemoryUsedMB();
        const systemGrowth =
          currentSystemMem - this.metrics.totalSystemMemoryStart;
        const nodeMemGrowth = this._getMemoryMB() - this.metrics.startMemory;
        const estimatedBrowserMem = Math.max(0, systemGrowth - nodeMemGrowth);

        return Math.round(estimatedBrowserMem * 10) / 10;
      }
    } catch {
      // Fallback: return 0 if everything fails
      return 0;
    }
  }

  /**
   * Set browser reference for tracking
   */
  setBrowserContext(page) {
    this.browserPage = page;
    this.browserMetricsAvailable = true;
  }

  /**
   * Update metrics during monitoring
   */
  async _updateMetrics() {
    this.metrics.currentMemory = this._getMemoryMB();
    if (this.metrics.currentMemory > this.metrics.peakMemory) {
      this.metrics.peakMemory = this.metrics.currentMemory;
    }

    // Update system memory usage
    const currentSystemMemory = this._getSystemMemoryUsedMB();
    if (currentSystemMemory > this.metrics.peakSystemMemoryUsed) {
      this.metrics.peakSystemMemoryUsed = currentSystemMemory;
    }

    // Update browser memory if available
    if (this.browserMetricsAvailable && this.browserPage) {
      const browserMem = await this._getBrowserMemoryMB(this.browserPage);
      this.metrics.browserCurrentMemory = browserMem;

      if (this.metrics.browserStartMemory === 0) {
        this.metrics.browserStartMemory = browserMem;
      }

      if (browserMem > this.metrics.browserPeakMemory) {
        this.metrics.browserPeakMemory = browserMem;
      }
    }

    // Log status every 10 seconds
    const elapsed = performance.now() - this.startTime;
    if (Math.round(elapsed / 1000) % 10 === 0) {
      this.logCurrentStatus();
    }
  }

  /**
   * Format duration in human readable format
   */
  _formatDuration(ms) {
    if (ms < 1000) {
      return `${Math.round(ms)}ms`;
    } else if (ms < 60000) {
      return `${Math.round(ms / 100) / 10}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.round((ms % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * Show simple performance assessment
   */
  _showPerformanceAssessment(totalDuration, memoryGrowth) {
    console.log('\n💡 Performance Assessment:');

    // Time assessment
    if (totalDuration < 30000) {
      console.log('   ✅ Speed: Excellent (under 30s)');
    } else if (totalDuration < 60000) {
      console.log('   ⚡ Speed: Good (under 1m)');
    } else {
      console.log('   ⚠️  Speed: Consider optimizing (over 1m)');
    }

    // Combined memory assessment
    const totalMemoryGrowth =
      memoryGrowth +
      (this.browserMetricsAvailable
        ? this.metrics.browserCurrentMemory - this.metrics.browserStartMemory
        : 0);
    const totalPeakMemory =
      this.metrics.peakMemory +
      (this.browserMetricsAvailable ? this.metrics.browserPeakMemory : 0);

    if (totalMemoryGrowth < 100) {
      console.log(
        `   ✅ Total Memory: Excellent (${totalMemoryGrowth.toFixed(1)}MB growth)`
      );
    } else if (totalMemoryGrowth < 200) {
      console.log(
        `   ⚡ Total Memory: Good (${totalMemoryGrowth.toFixed(1)}MB growth)`
      );
    } else {
      console.log(
        `   ⚠️  Total Memory: High usage (${totalMemoryGrowth.toFixed(1)}MB growth)`
      );
    }

    if (totalPeakMemory < 200) {
      console.log(
        `   ✅ Peak Usage: Efficient (${totalPeakMemory}MB combined)`
      );
    } else {
      console.log(`   ⚠️  Peak Usage: High (${totalPeakMemory}MB combined)`);
    }

    console.log('\n');
  }
}

export default SimplePerformanceMonitor;
