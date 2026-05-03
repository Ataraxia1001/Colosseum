import sys
from pathlib import Path

from langgraph.graph import END, START, StateGraph

try:
    from .nodes import (
        ChatState,
        openai_node,
        claude_node,
        gemini_node,
        openai_critique_node,
        claude_critique_node,
        gemini_critique_node,
        openai_evaluation_node,
        claude_evaluation_node,
        gemini_evaluation_node,
        summary_node,
    )
    from utils import save_graph_image
except ImportError:
    backend_dir = Path(__file__).resolve().parents[1]
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    from nodes import (
        ChatState,
        openai_node,
        claude_node,
        gemini_node,
        openai_critique_node,
        claude_critique_node,
        gemini_critique_node,
        openai_evaluation_node,
        claude_evaluation_node,
        gemini_evaluation_node,
        summary_node,
    )
    from utils import save_graph_image


graph = StateGraph(ChatState)
graph.add_node('openai', openai_node)
graph.add_node('claude', claude_node)
graph.add_node('gemini', gemini_node)
graph.add_node('openai_critique', openai_critique_node)
graph.add_node('claude_critique', claude_critique_node)
graph.add_node('gemini_critique', gemini_critique_node)
graph.add_node('openai_evaluation', openai_evaluation_node)
graph.add_node('claude_evaluation', claude_evaluation_node)
graph.add_node('gemini_evaluation', gemini_evaluation_node)
graph.add_node('summary', summary_node)

# Phase 1: all three run in parallel from START
graph.add_edge(START, 'openai')
graph.add_edge(START, 'claude')
graph.add_edge(START, 'gemini')

# Phase 2: each model critiques the other two.
graph.add_edge('claude', 'openai_critique')
graph.add_edge('gemini', 'openai_critique')
graph.add_edge('openai', 'claude_critique')
graph.add_edge('gemini', 'claude_critique')
graph.add_edge('openai', 'gemini_critique')
graph.add_edge('claude', 'gemini_critique')

# Phase 3: all judge nodes wait for critiques, then end.
graph.add_edge('openai_critique', 'openai_evaluation')
graph.add_edge('claude_critique', 'openai_evaluation')
graph.add_edge('gemini_critique', 'openai_evaluation')
graph.add_edge('openai_critique', 'claude_evaluation')
graph.add_edge('claude_critique', 'claude_evaluation')
graph.add_edge('gemini_critique', 'claude_evaluation')
graph.add_edge('openai_critique', 'gemini_evaluation')
graph.add_edge('claude_critique', 'gemini_evaluation')
graph.add_edge('gemini_critique', 'gemini_evaluation')

# Phase 4: all evaluation nodes fan-in to summary, then end.
graph.add_edge('openai_evaluation', 'summary')
graph.add_edge('claude_evaluation', 'summary')
graph.add_edge('gemini_evaluation', 'summary')
graph.add_edge('summary', END)

chat_graph = graph.compile()


if __name__ == '__main__':
    # Run this file to see the graph image in the artifacts directory
    saved_path = save_graph_image(chat_graph)
    print(f'Saved graph image: {saved_path}')
