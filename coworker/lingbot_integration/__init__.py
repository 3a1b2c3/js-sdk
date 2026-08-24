"""
LingBot Integration API: Headless scenario execution for LingBot World 2.

Exports canonical types for building the Integration Runtime and Session.
"""

from .scenario import (
    InputType,
    IntegrationInput,
    IntegrationScenario,
    IntegrationSpec,
    ExecutionMetrics,
    ScenarioExecutionResult,
)

__all__ = [
    "InputType",
    "IntegrationInput",
    "IntegrationScenario",
    "IntegrationSpec",
    "ExecutionMetrics",
    "ScenarioExecutionResult",
]
