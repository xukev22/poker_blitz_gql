class Node<T> {
  data: T;
  next: Node<T> | null;

  constructor(data: T) {
    this.data = data;
    this.next = null;
  }
}

class CircularLinkedList<T> {
  head: Node<T> | null;

  constructor() {
    this.head = null;
  }

  append(data: T): void {
    const newNode = new Node(data);
    if (!this.head) {
      this.head = newNode;
      newNode.next = this.head;
    } else {
      let current = this.head;
      while (current.next !== this.head) {
        current = current.next!;
      }
      current.next = newNode;
      newNode.next = this.head;
    }
  }

  remove(player: T): void {
    if (!this.head) {
      throw new Error("Circular list is empty");
    }

    // Special case for the head
    if (this.head.data === player) {
      if (this.head.next === this.head) {
        this.head = null; // Removing the only node
      } else {
        let current = this.head;
        while (current.next !== this.head) {
          current = current.next!;
        }
        current.next = this.head.next;
        this.head = this.head.next;
      }
      return;
    }

    let current = this.head;
    let prev: Node<T> | null = null;

    do {
      prev = current;
      current = current.next!;
    } while (current !== this.head && current.data !== player);

    if (current !== this.head) {
      prev!.next = current.next;
    }
  }

  shuffle(): void {
    if (!this.head) {
      throw new Error("Circular list is empty");
    }

    // Convert the circular linked list to an array
    const nodeList: Node<T>[] = [];
    let current = this.head;
    do {
      nodeList.push(current);
      current = current.next!;
    } while (current !== this.head);

    // Shuffle the array
    const shuffledNodes = shuffleArray(nodeList);

    // Update the circular linked list with the shuffled elements
    for (let i = 0; i < shuffledNodes.length; i++) {
      shuffledNodes[i].next = shuffledNodes[(i + 1) % shuffledNodes.length];
    }

    this.head = shuffledNodes[0];
  }

  clone(): CircularLinkedList<T> {
    const clonedList = new CircularLinkedList<T>();

    if (!this.head) {
      return clonedList; // Return an empty list if the original list is empty
    }

    let originalCurrent = this.head;
    do {
      clonedList.append(originalCurrent.data);
      originalCurrent = originalCurrent.next!;
    } while (originalCurrent !== this.head);

    return clonedList;
  }

  find(player: T): Node<T> | null {
    if (!this.head) {
      throw new Error("Circular list is empty");
    }

    let current = this.head;
    do {
      if (current.data === player) {
        return current;
      }
      current = current.next!;
    } while (current !== this.head);

    throw new Error("Could not find a node");
  }

  getNthElement(n: number): Node<T> | null {
    if (!this.head || n < 0) {
      throw new Error("Circular list is empty or invalid n");
    }

    if (n === 0) {
      return this.head; // Return the head for n = 0
    }

    let current = this.head;
    for (let i = 1; i < n; i++) {
      current = current.next!;
      if (current === this.head) {
        throw new Error(
          "Reached end of circular list, and n is larger than the list size"
        );
      }
    }

    return current;
  }

  length(): number {
    if (!this.head) {
      return 0;
    }

    let count = 0;
    let current = this.head;
    do {
      count++;
      current = current.next!;
    } while (current !== this.head);

    return count;
  }

  forEach(callback: (data: T) => void): void {
    if (!this.head) {
      return;
    }

    let current = this.head;
    do {
      callback(current.data);
      current = current.next!;
    } while (current !== this.head);
  }

  print(): void {
    if (!this.head) {
      console.log("List is empty");
      return;
    }

    let current = this.head;
    do {
      console.log(current.data);
      current = current.next!;
    } while (current !== this.head);
  }
}

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Example usage
const myList = new CircularLinkedList<number>();
myList.append(1);
myList.append(2);
myList.append(3);

console.log("Original list:");
myList.print();

console.log("Executing forEach:");
myList.forEach((data) => {
  console.log(data * 2); // Perform some operation (e.g., multiply each element by 2)
});

console.log("After forEach:");
myList.print();
