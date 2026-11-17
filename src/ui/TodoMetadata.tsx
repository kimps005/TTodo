import { Text, View } from 'react-native';
import { dueLabel, type Todo } from '../domain/todo';
import { ui } from './theme';

export function TodoMetadata({ todo }: { todo: Todo }) {
  return <View style={[ui.row, { flexWrap: 'wrap' }]}>
    <Text style={ui.small}>{dueLabel(todo)}</Text>
    {todo.source_type !== 'manual' && <Text style={ui.pill}>AI 제안</Text>}
  </View>;
}
