from pathlib import Path

from langgraph.graph import END, START, StateGraph

from nodes import (
    ChatState,
    openai_node,
    claude_node,
    gemini_node,
    openai_critique_node,
    claude_critique_node,
    gemini_critique_node,
    evaluation_node,
)


graph = StateGraph(ChatState)
graph.add_node('openai', openai_node)
graph.add_node('claude', claude_node)
graph.add_node('gemini', gemini_node)
graph.add_node('openai_critique', openai_critique_node)
graph.add_node('claude_critique', claude_critique_node)
graph.add_node('gemini_critique', gemini_critique_node)
graph.add_node('evaluation', evaluation_node)

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

# Phase 3: evaluation waits for all critiques, then ends.
graph.add_edge('openai_critique', 'evaluation')
graph.add_edge('claude_critique', 'evaluation')
graph.add_edge('gemini_critique', 'evaluation')
graph.add_edge('evaluation', END)

chat_graph = graph.compile()


def save_graph_image(output_path: str | None = None) -> Path:
    artifacts_dir = Path(__file__).parent / 'artifacts'
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    image_path = Path(output_path) if output_path else artifacts_dir / 'chat_graph.png'
    png_data = chat_graph.get_graph().draw_mermaid_png()
    image_path.write_bytes(png_data)
    return image_path


if __name__ == '__main__':
    # Run this file to see the graph image in the artifacts directory
    saved_path = save_graph_image()
    print(f'Saved graph image: {saved_path}')