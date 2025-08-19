import { useState, useRef, useEffect } from 'react';
import { useStore } from '@tanstack/react-store';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Globe,
  Zap,
  Loader2,
  CheckCircle,
  AlertCircle,
  Copy,
  Download,
  ExternalLink,
  Clock,
  FileText,
  Search,
  Wifi,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import {
  healthCheck,
  scrapeStream,
  type StreamMessage,
  type ScrapingResult,
  type ScrapeRequestBody,
} from '@/lib/api';
import { setScrapeMode } from '@/lib/scrapeModeStore';

// Types
type ScrapingMode = 'normal' | 'beast';
type PhaseStatus = 'pending' | 'active' | 'completed' | 'error';

interface ScrapingFormData extends ScrapeRequestBody {}

interface PhaseInfo {
  name: string;
  status: PhaseStatus;
  message?: string;
  startTime?: string;
  endTime?: string;
}

// StreamMessage and ScrapingResult imported from API layer

// Constants
const PHASES_NORMAL = [
  'browser-setup',
  'page-loading',
  'iframe-processing',
  'content-extraction',
];

const PHASES_BEAST = [
  'browser-setup',
  'page-loading',
  'iframe-processing',
  'ai-element-detection',
  'dynamic-content-extraction',
  'content-processing',
];

const PHASE_DISPLAY_NAMES = {
  'browser-setup': 'Browser Setup',
  'page-loading': 'Page Loading',
  'iframe-processing': 'Loading Content',
  'content-extraction': 'Response Generating',
  'ai-element-detection': 'AI Content Analysis',
  'dynamic-content-extraction': 'Dynamic Content',
  'content-processing': 'Response Generating',
};

export function ScrapingInterface() {
  const [currentPhase, setCurrentPhase] = useState('');
  const [result, setResult] = useState<ScrapingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phases, setPhases] = useState<PhaseInfo[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Form setup
  const form = useForm({
    defaultValues: { url: '', mode: 'normal' as ScrapingMode, query: '' },
    onSubmit: async ({ value }) => handleScraping(value),
  });

  // Reactive subscription to current mode so UI badges update immediately
  const currentModeValue = useStore(
    form.store,
    s => s.values.mode as ScrapingMode
  );

  // Keep global header badge in sync with current selection
  useEffect(() => {
    setScrapeMode(currentModeValue);
  }, [currentModeValue]);

  // Get current phases based on mode
  const getCurrentPhases = () => {
    return currentModeValue === 'normal' ? PHASES_NORMAL : PHASES_BEAST;
  };

  // Helper functions
  const resetState = () => {
    setCurrentPhase('Initializing...');
    setResult(null);
    setError(null);
    setPhases([]);
  };

  // Mutations
  const scrapeMutation = useMutation({
    mutationFn: async (formData: ScrapingFormData) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      resetState();
      try {
        await scrapeStream(
          {
            url: formData.url.trim(),
            mode: formData.mode,
            query: formData.query?.trim() || '',
          },
          (message: StreamMessage) => handleStreamMessage(message),
          controller.signal
        );
      } finally {
        abortControllerRef.current = null;
      }
      return null;
    },
    onError: (err: any) => {
      if (err?.name === 'AbortError') {
        setCurrentPhase('Cancelled');
        toast.info('Scraping cancelled');
        return;
      }
      let errorMessage = 'Failed to scrape the URL';
      if (err?.name === 'TypeError' && err?.message?.includes('fetch')) {
        errorMessage =
          'Cannot connect to backend server. Please ensure the server is running on http://localhost:8080';
      } else if (err?.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      setCurrentPhase('Error');
      toast.error('Scraping failed: ' + errorMessage);
    },
  });

  const healthMutation = useMutation({
    mutationFn: async () => healthCheck(),
    onSuccess: () => {
      toast.success('Backend connection successful!', {
        description: 'Server is running and ready to accept requests',
        position: 'top-right',
      });
    },
    onError: (err: any) => {
      let errorMessage = 'Failed to connect to backend server';
      if (err?.name === 'TimeoutError') {
        errorMessage = 'Connection timeout - server may be down';
      } else if (err?.name === 'TypeError' && err?.message?.includes('fetch')) {
        errorMessage = 'Cannot reach server at http://localhost:8080';
      } else if (err?.message) {
        errorMessage = err.message;
      }
      toast.error('❌ Connection failed', {
        description: errorMessage,
        position: 'top-right',
      });
    },
  });

  const calculateProgress = () => {
    if (!scrapeMutation.isPending) return 100;

    const currentPhases = getCurrentPhases();

    // Define phase weights based on expected duration/complexity
    const phaseWeights = {
      'browser-setup': 10, // Quick setup
      'page-loading': 20, // Network dependent
      'iframe-processing': 15, // Medium complexity
      'content-extraction': 55, // Normal mode: larger portion for final processing
      'ai-element-detection': 25, // Most complex (beast mode only)
      'dynamic-content-extraction': 20, // Complex (beast mode only)
      'content-processing': 10, // Final processing (beast mode only)
    };

    // Calculate total weight for current mode's phases
    const totalWeight = currentPhases.reduce((sum, phaseName) => {
      const weight = phaseWeights[phaseName as keyof typeof phaseWeights] || 0;
      return sum + weight;
    }, 0);

    let accumulatedProgress = 0;

    currentPhases.forEach(phaseName => {
      const phase = phases.find(p => p.name === phaseName);
      const weight = phaseWeights[phaseName as keyof typeof phaseWeights] || 0;
      const phaseProgress = (weight / totalWeight) * 100;

      if (!phase || phase.status === 'pending') {
        // No progress for this phase
        return;
      } else if (phase.status === 'active') {
        // Phase in progress - calculate time-based progress if available
        if (phase.startTime) {
          const elapsed = Date.now() - new Date(phase.startTime).getTime();
          const estimatedDuration = weight * 1000; // Rough estimate: weight * 1 second
          const timeProgress = Math.min(elapsed / estimatedDuration, 0.9); // Max 90% for active phase
          accumulatedProgress += phaseProgress * timeProgress;
        } else {
          // Fallback: 50% for active phase
          accumulatedProgress += phaseProgress * 0.5;
        }
      } else if (phase.status === 'completed') {
        // Full progress for completed phase
        accumulatedProgress += phaseProgress;
      } else if (phase.status === 'error') {
        // Treat error as completed for progress purposes
        accumulatedProgress += phaseProgress;
      }
    });

    return Math.min(Math.round(accumulatedProgress), 95);
  };

  const updatePhase = (
    phaseName: string,
    status: PhaseStatus,
    message?: string
  ) => {
    setPhases(prev => {
      const existing = prev.find(p => p.name === phaseName);
      const timestamp = new Date().toISOString();

      if (existing) {
        return prev.map(p =>
          p.name === phaseName
            ? {
                ...p,
                status,
                message,
                endTime: ['completed', 'error'].includes(status)
                  ? timestamp
                  : p.endTime,
              }
            : p
        );
      }

      return [
        ...prev,
        { name: phaseName, status, message, startTime: timestamp },
      ];
    });
  };

  const handleStreamMessage = (message: StreamMessage) => {
    const messageHandlers = {
      phase_start: () => {
        if (message.phase) {
          updatePhase(message.phase, 'active', message.message);
          setCurrentPhase(message.message || message.phase);
        }
      },
      phase_end: () => {
        if (message.phase) {
          updatePhase(
            message.phase,
            message.success ? 'completed' : 'error',
            message.message
          );
        }
      },
      progress: () => {
        if (message.message || message.phase) {
          setCurrentPhase(message.message || message.phase || '');
        }
      },
      completed: () => {
        if (message.result?.success && message.result.data) {
          setResult(message.result.data);
          setCurrentPhase('Completed');
          toast.success('Scraping completed successfully!');
        } else {
          const errorMsg =
            message.result?.error ||
            'Scraping completed but no data was extracted';
          setError(errorMsg);
          setCurrentPhase('Error');
          toast.error('Scraping failed');
        }
      },
      error: () => {
        if (message.error) {
          const errorMsg = `${message.error.message}: ${message.error.details}`;
          setError(errorMsg);
          setCurrentPhase('Error');
          toast.error(`Error: ${message.error.message}`);
        }
      },
      done: () => {
        // Mutation lifecycle manages loading; no-op here
      },
      log: () => {},
      stream_complete: () => {},
    };

    messageHandlers[message.type]?.();
  };

  // Streaming handled by API helper; no local reader required

  // Main handlers
  const handleScraping = async (formData: ScrapingFormData) => {
    if (!formData.url.trim()) {
      toast.error('Please enter a valid URL');
      return;
    }
    // Kick off mutation
    scrapeMutation.mutate(formData);
  };

  const handleCancel = () => abortControllerRef.current?.abort();

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const downloadAsFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: filename,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Downloaded successfully!');
  };

  // Connection testing handled by mutation above

  // Render components
  const renderPhaseProgress = () => {
    const currentPhases = getCurrentPhases();

    return (
      <div className="flex items-center justify-center flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm">
          {currentPhases.map(phaseName => {
            const phase = phases.find(p => p.name === phaseName);
            const status = phase?.status || 'pending';
            const displayName =
              PHASE_DISPLAY_NAMES[
                phaseName as keyof typeof PHASE_DISPLAY_NAMES
              ];

            const iconMap = {
              pending: (
                <div className="w-2.5 h-2.5 rounded-full border-2 border-muted" />
              ),
              active: (
                <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
              ),
              completed: <CheckCircle className="w-3 h-3 text-green-500" />,
              error: <AlertCircle className="w-3 h-3 text-destructive" />,
            };

            const colorMap = {
              pending: 'text-muted-foreground border-muted bg-muted/30',
              active:
                'text-blue-600 dark:text-blue-400 border-blue-300/60 dark:border-blue-900/40 bg-blue-500/5',
              completed:
                'text-green-600 dark:text-green-400 border-green-300/60 dark:border-green-900/40 bg-green-500/5',
              error: 'text-destructive border-destructive/50 bg-destructive/10',
            };

            return (
              <div key={phaseName} className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${colorMap[status]} transition-colors`}
                >
                  <span className="flex-shrink-0">{iconMap[status]}</span>
                  {displayName}
                </span>
                <span className="text-muted-foreground text-xs">→</span>
              </div>
            );
          })}

          {/* Final completion status */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                result
                  ? 'text-green-600 dark:text-green-400 border-green-300/60 dark:border-green-900/40 bg-green-500/5'
                  : error
                    ? 'text-destructive border-destructive/50 bg-destructive/10'
                    : 'text-muted-foreground border-muted bg-muted/30'
              }`}
            >
              <span className="flex-shrink-0">
                {result && <CheckCircle className="w-3 h-3 text-green-500" />}
                {error && <AlertCircle className="w-3 h-3 text-destructive" />}
                {!result && !error && (
                  <div className="w-2.5 h-2.5 rounded-full border-2 border-muted" />
                )}
              </span>
              {result ? 'Completed' : error ? 'Error' : 'Pending'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderResultCard = () =>
    result && (
      <Card className="border border-border/60 shadow-sm min-w-0">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Extraction Results
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="hidden md:inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                {result.metadata.contentLength.markdown.toLocaleString()} chars
                <span className="mx-1 text-muted-foreground/60">•</span>
                <Clock className="h-3 w-3" />
                {(result.metadata.processingTime / 1000).toFixed(1)}s
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(result.markdown)}
                className="transition-colors"
              >
                <Copy className="h-4 w-4" />
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadAsFile(
                    result.markdown,
                    `scraped-${new URL(result.metadata.url).hostname}-${Date.now()}.md`
                  )
                }
                className="transition-colors"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="transition-colors"
              >
                <a
                  href={result.metadata.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open WebPage URL
                </a>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 min-w-0">
          {/* Tabs for Raw and Rendered Markdown */}
          <Tabs defaultValue="raw" className="w-full min-w-0">
            <TabsList className="flex w-full items-center gap-1 rounded-lg bg-muted/30 border border-border/60">
              <TabsTrigger
                className="group relative flex-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:border data-[state=active]:border-input"
                value="raw"
              >
                <span className="flex items-center justify-center gap-2">
                  <FileText className="h-4 w-4" />
                  LLM-Ready Markdown
                </span>
              </TabsTrigger>
              <TabsTrigger
                className="group relative flex-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:border data-[state=active]:border-input"
                value="rendered"
              >
                <span className="flex items-center justify-center gap-2">
                  <Eye className="h-4 w-4" />
                  Live Preview (Markdown)
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="raw" className="mt-4 min-w-0">
              <div className="max-h-[600px] overflow-y-auto overflow-x-auto rounded-md border border-input bg-transparent dark:bg-input/30 dark:border-input shadow-xs">
                <pre className="text-sm bg-transparent p-4 whitespace-pre font-mono overflow-x-auto overflow-y-hidden text-foreground">
                  {result.markdown}
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="rendered" className="mt-4 min-w-0">
              <div className="max-h-[600px] overflow-y-auto overflow-x-auto rounded-md border border-input bg-transparent dark:bg-input/30 dark:border-input shadow-xs">
                <div className="prose prose-sm dark:prose-invert max-w-none bg-transparent p-4 text-foreground [&_pre]:overflow-x-auto [&_pre]:whitespace-pre [&_pre]:max-w-full [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-xs [&_code]:whitespace-pre [&_table]:w-max">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                  >
                    {result.markdown}
                  </ReactMarkdown>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );

  return (
    <div className="grid gap-6">
      {/* Main Form */}
      <Card className="border border-border/60 shadow-sm transition-shadow hover:shadow-md">
        <CardContent>
          <form
            onSubmit={e => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-6"
          >
            {/* URL Input */}
            <form.Field name="url">
              {field => (
                <div className="space-y-2">
                  <Label htmlFor="url">Website URL</Label>
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://example.com"
                    value={field.state.value}
                    onChange={e => field.handleChange(e.target.value)}
                    disabled={scrapeMutation.isPending}
                    className="font-mono tracking-tight shadow-sm border-input/80 dark:border-input placeholder:text-muted-foreground/80 focus-visible:ring-2 focus-visible:ring-primary/40"
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-destructive">
                      {field.state.meta.errors[0]}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            {/* Mode Selection */}
            <form.Field name="mode">
              {field => (
                <div className="space-y-2">
                  <Label htmlFor="mode">Scraping Mode</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={value =>
                      field.handleChange(value as ScrapingMode)
                    }
                    disabled={scrapeMutation.isPending}
                  >
                    <SelectTrigger className="p-3 rounded-lg bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/60 focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors">
                      <SelectValue
                        placeholder="Select scraping mode"
                        aria-label={field.state.value}
                      >
                        {field.state.value && (
                          <div className="flex items-start gap-3">
                            {field.state.value === 'normal' ? (
                              <Search className="h-4 w-4 mt-1" />
                            ) : (
                              <Zap className="h-4 w-4 mt-1" />
                            )}
                            <div className="flex flex-col items-start">
                              <div className="font-medium">
                                {field.state.value === 'normal'
                                  ? 'Normal Mode'
                                  : 'Beast Mode'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {field.state.value === 'normal'
                                  ? 'Standard extraction - faster processing'
                                  : 'Deep AI extraction - comprehensive results'}
                              </div>
                            </div>
                          </div>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">
                        <div className="flex items-start gap-3">
                          <Search className="h-4 w-4 mt-1" />
                          <div>
                            <div className="font-medium">Normal Mode</div>
                            <div className="text-xs text-muted-foreground">
                              Standard extraction - faster processing
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="beast">
                        <div className="flex items-start gap-3">
                          <Zap className="h-4 w-4 mt-1" />
                          <div>
                            <div className="font-medium">Beast Mode</div>
                            <div className="text-xs text-muted-foreground">
                              Deep AI extraction - comprehensive results
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>

            {/* Query Input */}
            <form.Field name="query">
              {field => (
                <div className="space-y-2">
                  <Label htmlFor="query">Specific Query (Optional)</Label>
                  <Textarea
                    id="query"
                    placeholder="e.g., 'Extract all product prices and descriptions' or 'Find contact information and email addresses'"
                    value={field.state.value}
                    onChange={e => field.handleChange(e.target.value)}
                    disabled={scrapeMutation.isPending}
                    rows={3}
                    className="rounded-lg bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/60 focus-visible:ring-2 focus-visible:ring-primary/40"
                  />
                  <p className="text-xs text-muted-foreground">
                    Describe exactly what data you want to extract from the
                    website
                  </p>
                </div>
              )}
            </form.Field>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={scrapeMutation.isPending}
                className="flex-1 sm:flex-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {scrapeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4" />
                    Start Scraping
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => healthMutation.mutate()}
                disabled={scrapeMutation.isPending || healthMutation.isPending}
                className="min-w-[140px] transition-shadow hover:shadow-md"
              >
                {healthMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Wifi className="h-4 w-4" />
                    Test Connection
                  </>
                )}
              </Button>

              {scrapeMutation.isPending && (
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </form>

          {(scrapeMutation.isPending ||
            result ||
            error ||
            phases.length > 0) && (
            <div className="space-y-4 mt-6 border p-4 rounded-lg bg-muted/30">
              {/* Phase Progress */}
              <div className="space-y-4">{renderPhaseProgress()}</div>

              {/* Overall Progress Bar */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-sm text-muted-foreground">
                    {calculateProgress()}%
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-3">
                  <div
                    className="relative h-3 rounded-full transition-all duration-500 ease-out bg-primary"
                    style={{ width: `${calculateProgress()}%` }}
                  />
                </div>
              </div>

              {/* Current Phase */}
              {currentPhase && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {currentPhase}
                  </p>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <p className="text-sm text-destructive font-medium">
                      Error Occurred
                    </p>
                  </div>
                  <p className="text-sm text-destructive/80">{error}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {renderResultCard()}
    </div>
  );
}
