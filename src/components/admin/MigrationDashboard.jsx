// src/components/admin/MigrationDashboard.jsx
// Admin dashboard for analyzing and migrating to advanced image system

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle2, TrendingDown, Database, Zap } from 'lucide-react'
import {
  analyzeAllBuckets,
  createMigrationPlan,
  getOptimizationReport,
  healthCheckBucket,
  getBucketDashboard
} from '../../lib/image-migration-analyzer.js'

export default function MigrationDashboard() {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const data = await getBucketDashboard()
      setDashboard(data)
    } catch (error) {
      console.error('Failed to load dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center">Loading storage analysis...</div>
  }

  if (!dashboard) {
    return <div className="p-8 text-center text-red-600">Failed to load dashboard</div>
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="h-display">Image Storage Migration</h1>
        <p className="text-muted mt-2">Analyze and migrate to advanced hierarchical system</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-line">
        {['overview', 'buckets', 'recommendations', 'plan'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-all ${
              activeTab === tab
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <OverviewTab dashboard={dashboard} />
      )}

      {/* Buckets Tab */}
      {activeTab === 'buckets' && (
        <BucketsTab dashboard={dashboard} />
      )}

      {/* Recommendations Tab */}
      {activeTab === 'recommendations' && (
        <RecommendationsTab />
      )}

      {/* Plan Tab */}
      {activeTab === 'plan' && (
        <PlanTab />
      )}

      {/* Refresh Button */}
      <button
        onClick={loadDashboard}
        className="btn btn-primary"
      >
        Refresh Analysis
      </button>
    </div>
  )
}

function OverviewTab({ dashboard }) {
  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Database}
          title="Total Files"
          value={dashboard.aggregated.totalFiles}
        />
        <MetricCard
          icon={TrendingDown}
          title="Total Storage"
          value={`${dashboard.aggregated.totalSizeMB}MB`}
        />
        <MetricCard
          icon={CheckCircle2}
          title="Healthy Buckets"
          value={dashboard.aggregated.healthyBuckets}
          color="green"
        />
        <MetricCard
          icon={AlertCircle}
          title="Issues Found"
          value={dashboard.aggregated.recommendations}
          color={dashboard.aggregated.recommendations > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Status Summary */}
      <div className="border border-line rounded-2xl p-6 bg-paper space-y-4">
        <h2 className="font-display text-lg">Bucket Health</h2>
        {Object.entries(dashboard.buckets).map(([name, health]) => (
          <BucketHealthRow key={name} name={name} health={health} />
        ))}
      </div>
    </div>
  )
}

function BucketsTab({ dashboard }) {
  return (
    <div className="space-y-6">
      {Object.entries(dashboard.buckets).map(([name, health]) => (
        <BucketDetailCard key={name} name={name} health={health} />
      ))}
    </div>
  )
}

function RecommendationsTab() {
  const [recommendations, setRecommendations] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRecommendations()
  }, [])

  const loadRecommendations = async () => {
    try {
      const report = await getOptimizationReport()
      setRecommendations(report)
    } catch (error) {
      console.error('Failed to load recommendations:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading recommendations...</div>
  if (!recommendations) return <div>Failed to load recommendations</div>

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="border border-line rounded-2xl p-6 bg-paper space-y-2">
        <p className="text-sm text-muted">Potential Storage Savings</p>
        <p className="text-4xl font-bold text-accent">
          {recommendations.summary.potentialSavingsMB}MB
        </p>
        <p className="text-xs text-muted">
          {recommendations.summary.percentSavings}% reduction
        </p>
      </div>

      {/* Recommendations */}
      <div className="space-y-3">
        {recommendations.recommendations.map((rec, idx) => (
          <RecommendationCard key={idx} recommendation={rec} />
        ))}
      </div>

      {/* Expected Benefits */}
      <div className="border border-line rounded-2xl p-6 bg-paper space-y-4">
        <h3 className="font-display text-lg">Expected Benefits</h3>
        <ul className="space-y-2">
          {recommendations.expectedBenefits.map((benefit, idx) => (
            <li key={idx} className="flex gap-3 text-sm">
              <CheckCircle2 size={16} className="text-green-600 shrink-0 mt-0.5" />
              {benefit}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function PlanTab() {
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPlan()
  }, [])

  const loadPlan = async () => {
    try {
      const report = await getOptimizationReport()
      setPlan(report)
    } catch (error) {
      console.error('Failed to load plan:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading migration plan...</div>
  if (!plan) return <div>Failed to load plan</div>

  return (
    <div className="space-y-6">
      {/* Timeline */}
      <div className="border border-line rounded-2xl p-6 bg-paper space-y-4">
        <h3 className="font-display text-lg">Migration Timeline</h3>
        <div className="space-y-3">
          {plan.nextSteps.map((step) => (
            <TimelineStep key={step.step} step={step} />
          ))}
        </div>
      </div>

      {/* Time Estimates */}
      <div className="border border-line rounded-2xl p-6 bg-paper space-y-4">
        <h3 className="font-display text-lg">Time Estimates</h3>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(plan.timelineEstimate).map(([key, time]) => (
            <div key={key} className="p-3 bg-soft rounded-xl">
              <p className="text-xs text-muted capitalize">
                {key.replace(/_/g, ' ')}
              </p>
              <p className="font-medium mt-1">{time}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// COMPONENTS
// ============================================================================

function MetricCard({ icon: Icon, title, value, color = 'blue' }) {
  const colors = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    red: 'text-red-600'
  }

  return (
    <div className="border border-line rounded-2xl p-6 bg-paper space-y-2">
      <Icon size={24} className={colors[color]} strokeWidth={1.5} />
      <p className="text-xs text-muted">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}

function BucketHealthRow({ name, health }) {
  const statusColors = {
    healthy: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    critical: 'bg-red-100 text-red-700'
  }

  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-line">
      <div className="flex-1">
        <p className="font-medium capitalize">{name}</p>
        <p className="text-xs text-muted">
          {health.summary.totalFiles} files • {health.summary.totalSizeMB}MB
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Score bar */}
        <div className="w-24 h-2 bg-soft rounded-full overflow-hidden">
          <div
            className={`h-full ${
              health.scores.overall >= 80
                ? 'bg-green-600'
                : health.scores.overall >= 50
                ? 'bg-yellow-600'
                : 'bg-red-600'
            }`}
            style={{ width: `${health.scores.overall}%` }}
          />
        </div>

        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[health.status]}`}>
          {health.scores.overall}%
        </span>
      </div>
    </div>
  )
}

function BucketDetailCard({ name, health }) {
  return (
    <div className="border border-line rounded-2xl p-6 bg-paper space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-display text-lg capitalize">{name}</h3>
          <p className="text-sm text-muted">
            {health.summary.totalFiles} files • {health.summary.totalSizeMB}MB
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Health Score</p>
          <p className="text-3xl font-bold text-accent">{health.scores.overall}%</p>
        </div>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-3 gap-3">
        <ScoreIndicator label="Organization" score={health.scores.organization} />
        <ScoreIndicator label="Compression" score={health.scores.compression} />
        <ScoreIndicator label="Cleanliness" score={health.scores.cleanliness} />
      </div>

      {/* Issues */}
      {health.issues.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-line">
          {health.issues.map((issue, idx) => (
            <IssueItem key={idx} issue={issue} />
          ))}
        </div>
      )}

      {health.issues.length === 0 && (
        <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700 flex gap-2">
          <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
          Bucket is in good condition
        </div>
      )}
    </div>
  )
}

function ScoreIndicator({ label, score }) {
  const color = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600'

  return (
    <div className="p-3 rounded-xl bg-soft text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-lg font-bold ${color} mt-1`}>{score}%</p>
    </div>
  )
}

function RecommendationCard({ recommendation }) {
  const priorityColors = {
    high: 'bg-red-50 border-red-200 text-red-700',
    medium: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    low: 'bg-blue-50 border-blue-200 text-blue-700'
  }

  return (
    <div className={`p-4 rounded-xl border ${priorityColors[recommendation.priority]}`}>
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1">
          <p className="font-medium text-sm">{recommendation.issue}</p>
          <p className="text-xs mt-1 opacity-80">{recommendation.action}</p>
          {recommendation.estimatedSavings && (
            <p className="text-xs mt-2 font-medium">
              Potential savings: {recommendation.estimatedSavings}
            </p>
          )}
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap capitalize ${priorityColors[recommendation.priority]}`}>
          {recommendation.priority}
        </span>
      </div>
    </div>
  )
}

function TimelineStep({ step }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-sm font-bold">
          {step.step}
        </div>
        {step.step < 5 && (
          <div className="w-0.5 h-16 bg-line mt-2" />
        )}
      </div>
      <div className="pb-8">
        <p className="font-medium">{step.title}</p>
        <p className="text-sm text-muted mt-1">{step.action}</p>
        <p className="text-xs text-muted mt-2 font-mono bg-soft px-2 py-1 rounded inline-block">
          {step.expectedOutput}
        </p>
      </div>
    </div>
  )
}

function IssueItem({ issue }) {
  return (
    <div className="flex items-start gap-2 text-sm text-yellow-700 bg-yellow-50 p-2 rounded-lg border border-yellow-200">
      <AlertCircle size={16} className="shrink-0 mt-0.5" />
      <div>
        <p className="font-medium">{issue.issue}</p>
        <p className="text-xs opacity-80 mt-0.5">{issue.recommendation}</p>
      </div>
    </div>
  )
}
